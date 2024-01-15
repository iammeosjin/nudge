import uniq from 'https://deno.land/x/ramda@v0.27.2/source/uniq.js';
// @deno-types=npm:@types/bluebird
import Bluebird from 'npm:bluebird';
import octokit from '../libs/octokit.ts';
import {
	GithubAPIRepository,
	PullRequest,
	PullRequestResponse,
} from '../types/pull-request.ts';

const REVIEWER_QUERY = `query pullRequests(
    $owner: String!
    $repo: String!
    $first: Int = 1
    $after: String
    $headRefName: String
    $reviewFirst: Int = 50
    $reviewAfter: String
) {
    repository(owner: $owner, name: $repo) {
        pullRequests(
            first: $first
            after: $after
            headRefName: $headRefName
            orderBy: { field: UPDATED_AT, direction: DESC }
            states: [MERGED]
        ) {
            pageInfo {
                hasNextPage
                endCursor
            }
            nodes {
                reviews(first: $reviewFirst, after: $reviewAfter) {
                    nodes {
                        state
                        author {
                            login
                        }
                    }
                    pageInfo {
                        endCursor
                        hasNextPage
                    }
                    totalCount
                }
                author {
                    login
                }
                headRefName
            }
        }
    }
}`;

const PULL_REQUEST_QUERY = `query pullRequests(
    $owner: String!
    $repo: String!
    $first: Int
		$last: Int
    $after: String
		$before: String
) {
    repository(owner: $owner, name: $repo) {
        pullRequests(
            first: $first
						last: $last
            after: $after
						before: $before
            orderBy: { field: UPDATED_AT, direction: DESC }
            states: [MERGED]
        ) {
            pageInfo {
                hasNextPage
                endCursor
								startCursor
								hasPreviousPage
            }
            nodes {
                title
                merged
                state
                number
                createdAt
                mergedAt
                updatedAt
                closedAt
                reviews(first: 50) {
                    nodes {
                        state
                        author {
                            login
                        }
                    }
                    pageInfo {
                        endCursor
                        hasNextPage
                    }
                    totalCount
                }
                author {
                    login
                }
                headRefName
                body
								permalink
            }
        }
    }
}`;

function getIssuesFromPRBody(body: string) {
	const lines = body.split('\n');
	const issues = [];
	for (let i = 0, reference = 0; i < lines.length; i++) {
		const line = lines[i].toLowerCase();
		if (line.startsWith('## reference')) {
			reference += 1;
		} else if (reference === 1) {
			if (line.includes('row')) {
				issues.push(lines[i].match(/ROW-(.*[0-9])/)?.at(0));
			}
		} else if (line.startsWith('## actions')) {
			break;
		}
	}

	return uniq(issues.filter((issue) => !!issue)) as string[];
}

export class GithubAPI {
	static async getReviewers(
		repository: GithubAPIRepository,
		params: {
			headRefName: string;
			reviewFirst?: number;
			reviewAfter?: string;
		},
	): Promise<string[]> {
		console.log('get additional reviwers');
		const { repository: { pullRequests } } = await octokit.graphql(
			REVIEWER_QUERY,
			{
				...repository,
				...params,
				first: 1,
			},
		) as { repository: { pullRequests: { nodes: PullRequestResponse[] } } };

		if (pullRequests.nodes.length > 1) {
			throw new Error(`Invalid pr length: ${params.headRefName}`);
		}

		const reviews = pullRequests.nodes[0]?.reviews;

		let reviewers = [];

		reviewers = uniq(
			(reviews?.nodes || []).map((review) => review.author.login),
		);

		if (reviews?.pageInfo.hasNextPage) {
			reviewers = uniq([
				...reviewers,
				...await GithubAPI.getReviewers(repository, {
					...params,
					reviewAfter: reviews.pageInfo.endCursor,
				}),
			]);
		}

		return reviewers;
	}

	static async getPullRequests(params: {
		owner: string;
		repo: string;
		after?: string;
		before?: string;
		first?: number;
		last?: number;
	}): Promise<
		{
			pullRequests: PullRequest[];
			endCursor?: string;
			startCursor?: string;
			hasNextPage: boolean;
			hasPreviousPage: boolean;
		}
	> {
		const { repository } = await octokit.graphql(
			PULL_REQUEST_QUERY,
			params,
		) as unknown as {
			repository: {
				pullRequests: {
					nodes: PullRequestResponse[];
					pageInfo: {
						hasNextPage: boolean;
						hasPreviousPage: boolean;
						endCursor?: string;
						startCursor?: string;
					};
				};
			};
		};

		const pullRequests: PullRequest[] = await Bluebird.map<
			PullRequestResponse,
			PullRequest
		>(
			repository.pullRequests.nodes,
			async (pr) => {
				let firstReviewer: string;
				let currentFirstReviewer: string;
				let reviewers = pr.reviews.nodes.map((review, index) => {
					currentFirstReviewer = review.author.login;
					if (index === 0) {
						if (
							review.state === 'CHANGES_REQUESTED' ||
							review.state === 'COMMENTED'
						) {
							firstReviewer = currentFirstReviewer;
						}
					} else {
						if (!firstReviewer) {
							currentFirstReviewer = review.author.login;
							firstReviewer = currentFirstReviewer;
						}
					}

					return review.author.login;
				});

				reviewers = uniq(reviewers);
				const result = {
					merged: pr.merged,
					mergedAt: pr.mergedAt,
					createdAt: pr.createdAt,
					updatedAt: pr.updatedAt,
					headRefName: pr.headRefName,
					author: pr.author.login,
					reviewers: reviewers,
					firstReviewer: reviewers[0],
					issues: getIssuesFromPRBody(pr.body),
					permalink: pr.permalink,
				};

				if (!pr.reviews.pageInfo.hasNextPage) return result;
				return {
					...result,
					reviewers: uniq(
						[
							...reviewers,
							...await GithubAPI.getReviewers(
								{ owner: params.owner, repo: params.repo },
								{
									headRefName: pr.headRefName,
									reviewAfter: pr.reviews.pageInfo.endCursor,
								},
							),
						],
					),
				};
			},
		);
		return {
			pullRequests,
			endCursor: repository.pullRequests.pageInfo.endCursor,
			startCursor: repository.pullRequests.pageInfo.startCursor,
			hasNextPage: repository.pullRequests.pageInfo.hasNextPage,
			hasPreviousPage: repository.pullRequests.pageInfo.hasPreviousPage,
		};
	}
}
