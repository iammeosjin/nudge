import octokit from '../libs/octokit.ts';
import { PullRequest, PullRequestResponse } from '../types.ts';

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
            states: [OPEN]
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

// function getIssuesFromPRBody(body: string) {
// 	const lines = body.split('\n');
// 	const issues = [];
// 	for (let i = 0, reference = 0; i < lines.length; i++) {
// 		const line = lines[i].toLowerCase();
// 		if (line.startsWith('## reference')) {
// 			reference += 1;
// 		} else if (reference === 1) {
// 			if (line.includes('row')) {
// 				issues.push(lines[i].match(/ROW-(.*[0-9])/)?.at(0));
// 			}
// 		} else if (line.startsWith('## actions')) {
// 			break;
// 		}
// 	}

// 	return uniq(issues.filter((issue) => !!issue)) as string[];
// }

export type GithubRequestOptions = {
	owner: string;
	repo: string;
	after?: string;
	before?: string;
	first?: number;
	last?: number;
};
export class GithubAPI {
	static async getPullRequests(params: GithubRequestOptions): Promise<
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

		return {
			pullRequests: repository.pullRequests.nodes.map((pr) => ({
				merged: pr.merged,
				mergedAt: pr.mergedAt,
				createdAt: pr.createdAt,
				updatedAt: pr.updatedAt,
				headRefName: pr.headRefName,
				author: pr.author.login,
				permalink: pr.permalink,
			})),
			endCursor: repository.pullRequests.pageInfo.endCursor,
			startCursor: repository.pullRequests.pageInfo.startCursor,
			hasNextPage: repository.pullRequests.pageInfo.hasNextPage,
			hasPreviousPage: repository.pullRequests.pageInfo.hasPreviousPage,
		};
	}
}
