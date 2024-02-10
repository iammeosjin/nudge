import Dataloader from 'npm:dataloader';
import { JiraAPI } from '../../apis/jira.ts';
import { Issue, JiraRequestOptions } from '../../types.ts';

async function consumeJiraIssues(
	result: {
		filter: { keys: string[] };
		issues: Issue[];
	},
	options?: Partial<JiraRequestOptions>,
) {
	const response = await JiraAPI.getIssues({
		assignees: result.filter.keys,
		types:
			'(Bug, Story, subTaskIssueTypes(), standardIssueTypes(), Sub-task, Defect)',
	});

	result.issues = [...result.issues, ...response.issues];

	if ((response.startAt + response.maxResults) < response.total) {
		return consumeJiraIssues(result, {
			...options,
			startAt: response.startAt + response.maxResults,
		});
	}

	return result.issues;
}

const loader = async (
	keys: readonly string[],
) => {
	const issues = await consumeJiraIssues({
		issues: [],
		filter: { keys: keys as string[] },
	});
	return keys.map((key) => {
		return issues.filter((issue) => issue.assignee.id === key);
	});
};

const jiraIssuesLoader = new Dataloader<string, Issue[]>(loader);

export default jiraIssuesLoader;
