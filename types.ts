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
	permalink: string;
};

export enum JiraIssueType {
	EPIC = 'EPIC',
	BUG = 'BUG',
	TASK = 'TASK',
	SUBTASK = 'SUBTASK',
	STORY = 'STORY',
	HOTFIX = 'HOTFIX',
	DEFECT = 'DEFECT',
	BASIC_TASK = 'BASIC_TASK',
}

export enum JiraStatus {
	BACKLOG = 'Backlog',
	READY = 'Ready',
	IN_PROGRESS = 'In Progress',
	DONE = 'Done',
	CANCELED = 'Canceled',
	UAT_FAILED_PRODUCTION = 'UAT Failed (Production)',
	UAT_FAILED_STAGING = 'UAT Failed (Staging)',
	UAT_PRODUCTION = 'UAT (Production)',
	UAT_STAGING = 'UAT (Staging)',
	READY_FOR_RELEASE = 'Ready for Release',
}

export interface Issue {
	key: string;
	summary: string;
	assignee: string;
	reporter: string;
	status: JiraStatus;
	type: JiraIssueType;
	parent?: Pick<Issue, 'key' | 'type' | 'status'>;
	subTasks: Pick<Issue, 'key' | 'type' | 'status' | 'summary'>[];
}

export type JiraIssueFieldsResponse = {
	summary: string;
	issuetype: { id: string };
	status: { name: string };
	subtasks?: { key: string; fields: JiraIssueFieldsResponse }[];
	parent?: { key: string; fields: JiraIssueFieldsResponse };
	assignee: { accountId: string; displayName: string };
	reporter: { accountId: string; displayName: string };
	statuscategorychangedate: string;
	updated: string;
	created: string;
};

export type JiraChangeLogResponse = {
	histories: {
		created: string;
		items: [
			{ field: string; fromString: string; toString: string },
		];
	}[];
};

export type JiraRequestOptions = {
	startAt: number;
	maxResults: number;
	total: number;
};

export enum Team {
	OPEXA = 'opexa',
	NEXIUX = 'nexiux',
}

export enum TriggerType {
	T1 = 'all subtasks are done but the acceptance testing card still in backlog status',
	T2 = 'all subtasks are done including the acceptance testing but the parent card still in progress status',
	T3 = 'pull request is in stale for more than 5 minutes',
	T4 = 'there are pending pull request or subtasks on the closing hours',
	T5 = 'task is not in progress status but have subtask that are already in progress',
	T6 = 'there are acceptance testing that are in ready or in progress but other subtask are not done yet',
}

export type Trigger = {
	id: ID;
	type: TriggerType;
	body: {
		link: string;
		key: string;
		recipient?: User;
	};
	lastTriggeredAt?: string;
};

export type ID = (string | number)[];

export type KVEntry = {
	id: ID;
};

export type SlackBlock = {
	type: string;
	text?: {
		type: string;
		text: string;
	};
	elements?: {
		type: string;
		text: string;
	}[];
};

export type User = {
	department: 'BACKEND' | 'FRONTEND' | 'SQA';
	name: string;
	github?: string;
	jira?: string;
	slack?: string;
	emoji?: string;
};
