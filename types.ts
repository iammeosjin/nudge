import { AnyMessageBlock } from 'https://deno.land/x/slack_web_api_client@0.7.6/index.ts';

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

export enum JiraIssueJobType {
	BACKEND = 'BACKEND',
	FRONTEND = 'FRONTEND',
}

export type JiraIssueFilter = Partial<
	{
		statuses: JiraStatus[];
		assignees: string[];
		types: string;
	}
>;

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
	assignee: {
		displayName: string;
		id: string;
	};
	reporter: {
		displayName: string;
		id: string;
	};
	status: JiraStatus;
	type: JiraIssueType;
	statusCategoryChangeDate: string;
	jobType?: JiraIssueJobType;
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
	customfield_10813?: { value: string };
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
	T7 = 'there is no acceptance testing',
	T8 = 'there is no tasks in tasks board for backend/frontend',
	T9 = 'there is no currently task assigned to BE devs',
	T10 =
		'parent is in progress and all other subtasks are done but there are backlogs',
}

export type TriggerUser = {
	slack?: string;
	name: string;
};

export type Trigger = {
	id: ID;
	type: TriggerType;
	body?: {
		href: string;
		title: string;
		status?: JiraStatus;
		key: string;
		recipient?: TriggerUser;
	};
	lastTriggeredAt?: string;
	snoozed?: boolean;
};

export type ID = (string | number)[];

export type KVEntry = {
	id: ID;
};

export type SlackBlock = AnyMessageBlock;

export type User = {
	department: 'BACKEND' | 'FRONTEND' | 'SQA';
	name: string;
	github?: string;
	jira?: string;
	slack?: string;
	emoji?: string;
};

export type Job = {
	id: ID;
	status: 'READY' | 'RUNNING' | 'DONE' | 'FAILED';
};
