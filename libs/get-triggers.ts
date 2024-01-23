// @deno-types=npm:@types/bluebird
import Bluebird from 'npm:bluebird';
import { Issue, JiraStatus, Trigger, TriggerType } from '../types.ts';
import isEmpty from 'https://deno.land/x/ramda@v0.27.2/source/isEmpty.js';
import uniq from 'https://deno.land/x/ramda@v0.27.2/source/uniq.js';
import all from 'https://deno.land/x/ramda@v0.27.2/source/all.js';
import getUser from './get-user.ts';

type SubTaskBreakdwon = {
	atCards: Pick<Issue, 'key' | 'type' | 'status' | 'summary'>[];
	devCards: Pick<Issue, 'key' | 'type' | 'status' | 'summary'>[];
	cardStatuses: JiraStatus[];
	atCardStatuses: JiraStatus[];
	devCardStatuses: JiraStatus[];
	allAtCardsDone: boolean;
	allDevCardsDone: boolean;
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

function allDone(statuses: JiraStatus[]) {
	return all(
		(status: JiraStatus) =>
			status === JiraStatus.DONE || status === JiraStatus.CANCELED,
		statuses,
	);
}

export default function getTriggers(
	issues: Issue[],
	triggers?: Trigger[],
): Promise<{ triggers: Trigger[]; issues: (Issue & SubTaskBreakdwon)[] }> {
	return Bluebird.reduce(
		issues,
		(
			acc: { triggers: Trigger[]; issues: (Issue & SubTaskBreakdwon)[] },
			issue: Issue,
		) => {
			const subTasks = issue.subTasks || [];
			if (isEmpty(subTasks)) return acc;
			const breakdown = subTasks.reduce(
				(accum, curr) => {
					if (
						(curr.summary || '').toLowerCase().includes(
							'acceptance testing',
						)
					) {
						accum.atCards.push(curr);
						accum.atCardStatuses.push(curr.status);
					} else {
						accum.devCards.push(curr);
						accum.devCardStatuses.push(curr.status);
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
					devCardStatuses: [],
					allDevCardsDone: true,
					allAtCardsDone: true,
				} as SubTaskBreakdwon,
			);

			const {
				atCards,
				devCards,
				cardStatuses,
				atCardStatuses,
				devCardStatuses,
			} = breakdown;

			const allDevCardsDone = !isEmpty(devCards) &&
				allDone(devCardStatuses);

			const allAtCardsDone = !isEmpty(atCards) &&
				allDone(atCardStatuses);

			acc.issues.push({
				...issue,
				...breakdown,
				allAtCardsDone,
				allDevCardsDone,
			});

			const trigger = {
				link: `https://identifi.atlassian.net/browse/${issue.key}`,
				key: issue.key,
				recipient: getUser({ jira: issue.assignee }),
			};

			if (
				issue.status === JiraStatus.READY ||
				issue.status === JiraStatus.BACKLOG
			) {
				if (
					cardStatuses.includes(JiraStatus.IN_PROGRESS) ||
					cardStatuses.includes(JiraStatus.READY)
				) {
					acc.triggers.push({
						id: [issue.key],
						type: TriggerType.T5,
						body: trigger,
					});
					return acc;
				}
			}

			if (
				issue.status === JiraStatus.IN_PROGRESS && isEmpty(atCards) &&
				!isEmpty(devCards)
			) {
				acc.triggers.push({
					id: [issue.key],
					type: TriggerType.T7,
					body: trigger,
				});
			}

			if (
				allDevCardsDone &&
				!isEmpty(atCards) && atCardStatuses.includes(JiraStatus.BACKLOG)
			) {
				acc.triggers.push({
					id: [issue.key],
					type: TriggerType.T1,
					body: trigger,
				});
			} else if (
				allDevCardsDone &&
				(isEmpty(atCardStatuses) || allDone(atCardStatuses)) &&
				issue.status === JiraStatus.IN_PROGRESS
			) {
				acc.triggers.push({
					id: [issue.key],
					type: TriggerType.T2,
					body: trigger,
				});
			} else if (
				!isEmpty(devCards) && !allDevCardsDone &&
				(atCardStatuses.includes(JiraStatus.IN_PROGRESS) ||
					atCardStatuses.includes(JiraStatus.READY))
			) {
				acc.triggers.push({
					id: [issue.key],
					type: TriggerType.T6,
					body: trigger,
				});
			}

			return acc;
		},
		{ triggers: triggers || [], issues: [] },
	);
}
