import { JiraAPI } from '../apis/jira.ts';
// @deno-types=npm:@types/bluebird
import Bluebird from 'npm:bluebird';
import {
	Issue,
	JiraRequestOptions,
	JiraStatus,
	Trigger,
	TriggerType,
} from '../types.ts';
import uniq from 'https://deno.land/x/ramda@v0.27.2/source/uniq.js';
import isEmpty from 'https://deno.land/x/ramda@v0.27.2/source/isEmpty.js';

type ProcessedResult = {
	triggers: Trigger[];
};

/*
 * T1: when all subtasks are done but the acceptance testing card still in "backlog" status
 * T2: when all subtasks are done including the acceptance testing but the parent card still in "In Progress" status
 * T3: when pull request is in stale for more than 5 minutes
 * T4: when there are pending pull request or subtasks on the closing hours
 * T5: when there are parent card that are not in progress status but have children that are already in progress
 * T6: when there are acceptance testing that are in ready or in progress but other subtask are not done yet
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
		(acc: Trigger[], issue: Issue) => {
			const breakdown = (issue.subTasks || []).reduce(
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

			const {
				atCards,
				devCards,
				cardStatuses,
				atCardStatuses,
			} = breakdown;

			const allDevCardsDone = !isEmpty(devCards) &&
				breakdown.allDevCardsDone;

			const allAtCardsDone = !isEmpty(atCards) &&
				breakdown.allAtCardsDone;

			const trigger = {
				link: `https://identifi.atlassian.net/browse/${issue.key}`,
				key: issue.key,
				recipient: issue.assignee,
			};

			if (
				issue.status === JiraStatus.READY ||
				issue.status === JiraStatus.BACKLOG
			) {
				if (
					cardStatuses.includes(JiraStatus.IN_PROGRESS) ||
					cardStatuses.includes(JiraStatus.READY)
				) {
					console.log('T5');
					acc.push({
						type: TriggerType.T5,
						body: trigger,
					});
					return acc;
				}
			}

			if (
				allDevCardsDone &&
				!isEmpty(atCards) && atCardStatuses.includes(JiraStatus.BACKLOG)
			) {
				console.log('T1');
				acc.push({
					type: TriggerType.T1,
					body: trigger,
				});
			} else if (
				allDevCardsDone &&
				allAtCardsDone &&
				issue.status === JiraStatus.IN_PROGRESS
			) {
				console.log('T2');
				acc.push({
					type: TriggerType.T2,
					body: trigger,
				});
			} else if (
				!isEmpty(devCards) && !allDevCardsDone &&
				(atCardStatuses.includes(JiraStatus.IN_PROGRESS) ||
					atCardStatuses.includes(JiraStatus.READY))
			) {
				console.log('T6');
				acc.push({
					type: TriggerType.T6,
					body: trigger,
				});
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
