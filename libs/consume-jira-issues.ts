import { JiraAPI } from '../apis/jira.ts';
// @deno-types=npm:@types/bluebird
import Bluebird from 'npm:bluebird';
import { Issue, JiraRequestOptions, JiraStatus } from '../types/task.ts';
import uniq from 'https://deno.land/x/ramda@v0.27.2/source/uniq.js';
import isEmpty from 'https://deno.land/x/ramda@v0.27.2/source/isEmpty.js';

type ProcessedResult = {
	triggers: Issue[];
};

/*
 * A1: when all subtasks are done but the acceptance testing card still in "backlog" status
 * A2: when all subtasks are done including the acceptance testing but the parent card still in "In Progress" status
 * A3: when pull request is in stale for more than 5 minutes
 * A4: when there are pending pull request or subtasks on the closing hours
 * A5: when there are parent card that are not in progress status but have children that are already in progress
 * A6: when there are acceptance testing that are in ready or in progress but other subtask are not done yet
 */

type SubTaskBreakdwon = {
	atCards: Pick<Issue, 'key' | 'type' | 'status' | 'summary'>[];
	devCards: Pick<Issue, 'key' | 'type' | 'status' | 'summary'>[];
	cardStatuses: JiraStatus[];
	atCardStatuses: JiraStatus[];
	allDevCardsDone: boolean;
	allAtCardsDone: boolean;
};

export default async function consumeJiraIssues(
	result: ProcessedResult,
	options?: Partial<JiraRequestOptions>,
) {
	const response = await JiraAPI.getIssues(options);

	result.triggers = await Bluebird.reduce(
		response.issues,
		(acc: Issue[], issue: Issue) => {
			const {
				atCards,
				devCards,
				cardStatuses,
				allDevCardsDone,
				atCardStatuses,
				allAtCardsDone,
			} = (issue.subTasks || []).reduce(
				(accum, curr) => {
					if (
						(curr.summary || '').toLowerCase().includes(
							'acceptance testing',
						)
					) {
						accum.atCards.push(curr);
						accum.atCardStatuses.push(curr.status);
						accum.allAtCardsDone = accum.allAtCardsDone &&
							curr.status === JiraStatus.DONE;
					} else {
						accum.devCards.push(curr);
						accum.allDevCardsDone = accum.allDevCardsDone &&
							curr.status === JiraStatus.DONE;
					}

					accum.cardStatuses.push(curr.status);

					return {
						...accum,
						cardStatuses: uniq(accum.cardStatuses),
						atCardStatuses: uniq(accum.atCardStatuses),
					};
				},
				{
					atCards: [],
					devCards: [],
					cardStatuses: [],
					atCardStatuses: [],
					allDevCardsDone: true,
					allAtCardsDone: true,
				} as SubTaskBreakdwon,
			);

			if (issue.status === JiraStatus.READY) {
				if (
					cardStatuses.includes(JiraStatus.IN_PROGRESS) ||
					cardStatuses.includes(JiraStatus.DONE)
				) {
					console.log('A5');
					acc.push(issue);
					return acc;
				}
			} else if (issue.status === JiraStatus.BACKLOG) {
				if (
					cardStatuses.includes(JiraStatus.IN_PROGRESS) ||
					cardStatuses.includes(JiraStatus.READY)
				) {
					console.log('A5');
					acc.push(issue);
					return acc;
				}
			}

			if (
				!isEmpty(devCards) && allDevCardsDone &&
				!isEmpty(atCards) && atCardStatuses.includes(JiraStatus.BACKLOG)
			) {
				console.log('A1');
				acc.push(issue);
			} else if (
				!isEmpty(devCards) && allDevCardsDone &&
				!isEmpty(atCards) && allAtCardsDone &&
				issue.status === JiraStatus.IN_PROGRESS
			) {
				console.log('A2');
				acc.push(issue);
			}

			return acc;
		},
		result.triggers,
	);

	if ((response.startAt + response.maxResults) < response.total) {
		return consumeJiraIssues(result, {
			...options,
			startAt: response.startAt + response.maxResults,
		});
	}

	return result;
}
