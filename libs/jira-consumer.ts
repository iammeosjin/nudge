import { JiraAPI } from '../apis/jira.ts';
// @deno-types=npm:@types/bluebird
import Bluebird from 'npm:bluebird';
import { Issue, JiraRequestOptions } from '../types/task.ts';

type ProcessedResult = {
	triggers: Issue[];
};

export default async function jiraIssuesConsumer<T>(
	result: ProcessedResult,
	options?: Partial<JiraRequestOptions>,
) {
	const response = await JiraAPI.getIssues(options);

	await Bluebird.reduce(response.issues, (acc, issue) => {
		/*
     if ( all subtasks are done but the acceptance testing card still in "backlog" status ) {
			 acc.push(issue)
		 } else if ...
	 */
		return acc;
	}, result.triggers);

	if ((response.startAt + response.maxResults) < response.total) {
		return jiraIssuesConsumer(result, {
			...options,
			startAt: response.startAt + response.maxResults,
		});
	}

	return result;
}
