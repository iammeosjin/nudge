export type PullRequestResponse = {
	title: string;
	merged: boolean;
	state: string;
	number: number;
	createdAt: string;
	mergedAt: string;
	updatedAt: string;
	closedAt: string;
	headRefName: string;
	reviews: {
		nodes: {
			state: string;
			author: {
				login: string;
			};
		}[];
		pageInfo: {
			endCursor?: string;
			hasNextPage: boolean;
		};
		totalCount: number;
	};
	author: { login: string };
	body: string;
	permalink: string;
};

export type GithubAPIRepository = {
	owner: string;
	repo: string;
};

export type PullRequest = {
	merged: boolean;
	mergedAt: string;
	updatedAt: string;
	createdAt: string;
	headRefName: string;
	author: string;
	reviewers: string[];
	firstReviewer: string;
	permalink: string;
	issues: string[];
};
