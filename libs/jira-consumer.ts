import { JiraAPI } from '../apis/jira.ts';
// @deno-types=npm:@types/bluebird
import Bluebird from 'npm:bluebird';
import { Issue, JiraRequestOptions, JiraStatus } from '../types/task.ts';

type ProcessedResult = {
	triggers: Issue[];
};

type JiraCriteria = {
	hasATCard: boolean;
	aTCardStatus: JiraStatus;
	cardStatus: JiraStatus;
	hasDevCards: boolean;
	devCardsDone: boolean;
};

export default async function jiraIssuesConsumer<T>(
	result: ProcessedResult,
	options?: Partial<JiraRequestOptions>,
) {
	const response = await JiraAPI.getIssues(options);

	await Bluebird.reduce(response.issues, (acc: Issue[], issue: Issue) => {
		const acceptanceTestingCard = (issue.subTasks || [])
			.find((task) =>
				(task.summary || '').match(
					/\bAcceptance Testing\b/,
				)
			);

		const devCards = (issue.subTasks || []).filter((
			task,
		) => !(task.summary || '').match(
			/\bAcceptance Testing\b/,
		));

		const inProgressDevCards = (devCards || []).find((
			task,
		) => task.status !== 'Done' &&
			task.status !== 'Canceled'
		);

		const hasDevCards = devCards.length > 0;
		const criteria: JiraCriteria = {
			cardStatus: issue.status,
			hasATCard: !!acceptanceTestingCard,
			aTCardStatus: acceptanceTestingCard?.status as JiraStatus,
			hasDevCards,
			devCardsDone: hasDevCards && !inProgressDevCards,
		};

		if (
			criteria.hasDevCards && criteria.devCardsDone &&
			criteria.hasATCard && criteria.aTCardStatus === JiraStatus.BACKLOG
		) {
			console.log('A1');
			acc.push(issue);
		} else if (
			criteria.hasDevCards && criteria.devCardsDone &&
			criteria.hasATCard && criteria.aTCardStatus === JiraStatus.DONE &&
			criteria.cardStatus === JiraStatus.IN_PROGRESS
		) {
			console.log('A2');
			acc.push(issue);
		}

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
