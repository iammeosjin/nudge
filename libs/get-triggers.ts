// @deno-types=npm:@types/bluebird
import Bluebird from 'npm:bluebird';
import { Issue, JiraStatus, Trigger, TriggerType } from '../types.ts';
import isEmpty from 'https://deno.land/x/ramda@v0.27.2/source/isEmpty.js';
import uniq from 'https://deno.land/x/ramda@v0.27.2/source/uniq.js';
import getUser from './get-user.ts';

type SubTaskBreakdwon = {
	atCards: Pick<Issue, 'key' | 'type' | 'status' | 'summary'>[];
	devCards: Pick<Issue, 'key' | 'type' | 'status' | 'summary'>[];
	cardStatuses: JiraStatus[];
	atCardStatuses: JiraStatus[];
	allDevCardsDone: boolean;
	allAtCardsDone: boolean;
};

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
						accum.allAtCardsDone = accum.allAtCardsDone &&
							curr.status === JiraStatus.DONE;
					} else {
						accum.devCards.push(curr);
						accum.allDevCardsDone = accum.allDevCardsDone &&
							(curr.status === JiraStatus.DONE ||
								curr.status === JiraStatus.CANCELED);
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
				allAtCardsDone &&
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
