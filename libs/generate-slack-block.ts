// @deno-types=npm:@types/bluebird
import Bluebird from 'npm:bluebird';
// @deno-types=npm:@types/luxon
import { DateTime } from 'npm:luxon';
import toPairs from 'https://deno.land/x/ramda@v0.27.2/source/toPairs.js';
import groupBy from 'https://deno.land/x/ramda@v0.27.2/source/groupBy.js';
import { SlackBlock, Trigger, TriggerType } from '../types.ts';
import { addTrigger, getTrigger } from '../controllers/trigger.ts';
import isEmpty from 'https://deno.land/x/ramda@v0.27.2/source/isEmpty.js';
import pluck from 'https://deno.land/x/ramda@v0.27.2/source/pluck.js';
import flatten from 'https://deno.land/x/ramda@v0.27.2/source/flatten.js';
import uniq from 'https://deno.land/x/ramda@v0.27.2/source/uniq.js';

export default async function generateSlackBlocks(
	triggers: Trigger[],
): Promise<{ blocks: SlackBlock[]; triggers: Trigger[] }> {
	const result = await Bluebird.map(
		toPairs(groupBy((t: Trigger) => t.type, triggers)),
		async ([type, triggersGroupedByType]: [TriggerType, Trigger[]]) => {
			const triggers = await Bluebird.map(
				triggersGroupedByType,
				async (t) => {
					const trigger = await getTrigger(t.id);
					if (!trigger) {
						return addTrigger(t);
					}

					if (!trigger.lastTriggeredAt) return trigger;

					const diffInMinutes = Math.floor(
						Math.abs(
							DateTime.fromISO(trigger.lastTriggeredAt).diffNow(
								'minutes',
							)
								.minutes,
						),
					);

					let maxDiffInMinutes = 30;

					/*
				allow trigger to have differ alert gaps based on trigger type
				if (trigger.type === TriggerType.T1) {
					maxDiffInMinutes = 60;
				}
				*/
					if (trigger.type === TriggerType.T7) {
						maxDiffInMinutes = 60;
						return null;
					}

					if (trigger.type === TriggerType.T3) {
						maxDiffInMinutes = 3;
						return null;
					}

					if (diffInMinutes < maxDiffInMinutes) {
						return null;
					}
					return trigger;
				},
				{
					concurrency: 20,
				},
			).then((ts) => ts.filter((t) => t !== null)) as Trigger[];

			if (isEmpty(triggers)) return { blocks: [], triggers: [] };

			// generate blocks for slack
			const contents = triggers.reduce((accum, curr) => {
				if (!curr.body) return accum;
				accum.links.push({
					href: curr.body.link,
					assignee: curr.body.recipient?.name,
				});
				if (curr.body.recipient?.slack) {
					accum.recipients.push(
						[
							curr.body.recipient.emoji || undefined,
							`<@${curr.body.recipient.slack.trim()}>`,
						].filter((r) => !!r).join(' '),
					);
				}
				if (curr.body.assignee?.slack) {
					accum.assignees.push(
						[
							`<@${curr.body.assignee.slack.trim()}>`,
							curr.body.assignee.emoji || undefined,
						].filter((r) => !!r).join(' '),
					);
				}

				return accum;
			}, {
				links: [],
				recipients: [],
				assignees: [],
			} as {
				links: { href: string; assignee?: string }[];
				recipients: string[];
				assignees: string[];
			});

			let title: string | undefined;
			if (type === TriggerType.T1) {
				title = 'Tasks are ready to be tested by our QAs';
			} else if (type === TriggerType.T2) {
				title = 'All subtasks are done, kindly update the status';
			}
			if (type === TriggerType.T3) {
				title = 'Pull request is in stale for more than 5 minutes';
			}
			if (type === TriggerType.T4) {
				title = 'Kindly close before the day ends';
			}
			if (type === TriggerType.T5) {
				title = 'These cards should be in In Progress status';
			}
			if (type === TriggerType.T6) {
				title = 'Are we sure these tasks are ready for testing?';
			}
			if (type === TriggerType.T7) {
				title = 'Can we check if these cards needs acceptance testing?';
			}
			if (type === TriggerType.T8) {
				title = 'Task board is empty, kindly add new task cards';
			}
			if (type === TriggerType.T9) {
				title = 'The following devs has no assigned task';
			}
			if (type === TriggerType.T10) {
				title =
					"Let's keep this moving. See if there are backlogs that can be move to ready";
			}

			const text = [
				`*${title}*`,
				!isEmpty(contents.assignees)
					? contents.assignees.join('\n')
					: '>```' +
						(contents.links.map((index) =>
							`${index.href}${
								index.assignee ? ` - ${index.assignee}` : ''
							}`
						)).join('\n') + '```',
			];

			if (!isEmpty(contents.links)) {
				text.push(
					'>```' +
						(contents.links.map((index) =>
							`${index.href}${
								index.assignee ? ` - ${index.assignee}` : ''
							}`
						)).join('\n') + '```',
				);
			}

			if (!isEmpty(contents.recipients)) {
				text.push(`>cc: ${uniq(contents.recipients).join(', ')}`);
			}

			return {
				blocks: [
					{
						type: 'section',
						text: {
							type: 'mrkdwn',
							text: text.join('\n'),
						},
					},
				] as SlackBlock[],
				triggers,
			};
		},
		{ concurrency: 20 },
	);

	// join all slack message blocks
	const slackMessageBlocks: SlackBlock[] = result.reduce(
		(accum: SlackBlock[], curr) => {
			if (isEmpty(curr.blocks)) return accum;

			if (isEmpty(accum)) return curr.blocks;

			return [
				...accum,
				{ type: 'divider' },
				...curr.blocks,
			];
		},
		[],
	);

	return {
		blocks: slackMessageBlocks,
		triggers: flatten(pluck('triggers', result)),
	};
}
