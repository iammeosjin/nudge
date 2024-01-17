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
	UAT_FAILED_PRODUCTION = 'UAT Failed (Production)',
	UAT_FAILED_STAGING = 'UAT Failed (Staging)',
	UAT_PRODUCTION = 'UAT (Production)',
	UAT_STAGING = 'UAT (Staging)',
	READY_FOR_RELEASE = 'Ready for Release',
}

export type NudgeCriteria = {
	hasATCard: boolean;
	aTCardStatus: JiraStatus;
	cardStatus: JiraStatus;
	devCardsDone: boolean;
};

export type JiraTask = {
	key: string;
	assignee: string;
	hasSubtask: boolean;
	type: JiraIssueType;
	created: string;
	updated: string;
	status: JiraStatus;
	parent?: Pick<JiraTask, 'key' | 'type' | 'status'>;
	assigneeName: string;
	criteria: NudgeCriteria;
};

export type JiraIssueFieldsResponse = {
	summary?: string;
	issuetype: { id: string };
	status: { name: string };
	subtasks?: { key: string; fields: JiraIssueFieldsResponse }[];
	parent?: { key: string; fields: JiraIssueFieldsResponse };
	assignee: { accountId: string; displayName: string };
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
