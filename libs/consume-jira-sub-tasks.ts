import { JiraAPI } from '../apis/jira.ts';
import { JiraIssueJobType, JiraRequestOptions, JiraStatus } from '../types.ts';

type ProcessedResult = {
	summary: {
		frontendSubTasks: number;
		backendSubTasks: number;
		assignees: Record<string, number>;
	};
};

/*
 * T8: there is tasks in the task board
 * T9: there is no task assigned to a BE dev
 */

export default async function consumeJiraSubTasks(
	result: ProcessedResult,
	options?: Partial<JiraRequestOptions>,
) {
	const response = await JiraAPI.getIssues({
		types:
			'(Bug, Story, subTaskIssueTypes(), standardIssueTypes(), Sub-task, Defect)',
	}, options);

	result.summary = response.issues.reduce(
		(accum: ProcessedResult['summary'], curr) => {
			if (
				curr.jobType === JiraIssueJobType.BACKEND &&
				curr.status === JiraStatus.READY
			) {
				accum.backendSubTasks = (accum.backendSubTasks || 0) + 1;
			}

			if (
				curr.jobType === JiraIssueJobType.FRONTEND &&
				curr.status === JiraStatus.READY
			) {
				accum.frontendSubTasks = (accum.frontendSubTasks || 0) + 1;
			}

			if (curr.assignee && accum?.assignees) {
				accum.assignees[curr.assignee] =
					(accum?.assignees[curr.assignee] || 0) + 1;
			}

			return accum;
		},
		result.summary || {},
	);

	console.log(
		'JIRA page',
		response.startAt + response.maxResults,
		response.total,
	);
	if ((response.startAt + response.maxResults) < response.total) {
		return consumeJiraSubTasks(result, {
			...options,
			startAt: response.startAt + response.maxResults,
		});
	}

	return result;
}
