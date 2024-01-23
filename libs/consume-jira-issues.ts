import { JiraAPI } from '../apis/jira.ts';
import { JiraIssueFilter, JiraRequestOptions, Trigger } from '../types.ts';
import getTriggers from './get-triggers.ts';

type ProcessedResult = {
	triggers: Trigger[];
	filter?: JiraIssueFilter;
};

/*
 * T1: when all subtasks are done but the acceptance testing card still in "backlog" status
 * T2: when all subtasks are done including the acceptance testing but the parent card still in "In Progress" status
 * T3: when pull request is in stale for more than 5 minutes
 * T4: when there are pending pull request or subtasks on the closing hours
 * T5: when there are parent card that are not in progress status but have children that are already in progress
 * T6: when there are acceptance testing that are in ready or in progress but other subtask are not done yet
 * T7: when there is no acceptance testing
 */

export default async function consumeJiraIssues(
	result: ProcessedResult,
	options?: Partial<JiraRequestOptions>,
) {
	const response = await JiraAPI.getIssues({}, options);

	result.triggers = await getTriggers(response.issues, result.triggers).then(
		(res) => res.triggers,
	);

	console.log(
		'JIRA page',
		response.startAt + response.maxResults,
		response.total,
	);
	if ((response.startAt + response.maxResults) < response.total) {
		return consumeJiraIssues(result, {
			...options,
			startAt: response.startAt + response.maxResults,
		});
	}

	return result;
}
