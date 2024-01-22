import '$std/dotenv/load.ts';

// @deno-types=npm:@types/bluebird
import Bluebird from 'npm:bluebird';
// @deno-types=npm:@types/luxon
import { DateTime } from 'npm:luxon';
import toPairs from 'https://deno.land/x/ramda@v0.27.2/source/toPairs.js';
import groupBy from 'https://deno.land/x/ramda@v0.27.2/source/groupBy.js';
import concat from 'https://deno.land/x/ramda@v0.27.2/source/concat.js';
import consumeJiraIssues from './consume-jira-issues.ts';
import consumeGithubPullRequests from './consume-github-pull-requests.ts';
import { SlackBlock, Team, Trigger, TriggerType } from '../types.ts';
import { GITHUB_REPOSITORIES } from './constants.ts';
import isEmpty from 'https://deno.land/x/ramda@v0.27.2/source/isEmpty.js';
import { addTrigger, getTrigger } from '../controllers/trigger.ts';
import slackClient from './slack-client.ts';

let lastTrigger: { lastTriggerAt?: string; triggers?: SlackBlock[] } = {};

export function getLastTrigger() {
	console.log('getLastTrigger', lastTrigger);
	return lastTrigger;
}

export default async function processTriggers() {
	// get all triggers and merge them
	const triggers: Trigger[] = concat(
		await consumeJiraIssues({ triggers: [] }).then((res) => res.triggers),
		await consumeGithubPullRequests({ triggers: [] }, {
			...GITHUB_REPOSITORIES[Team.NEXIUX],
		}).then((res) => res.triggers),
	);

	/*
	 * group triggers by type
	 * map each group and check if the trigger is already triggered
	 * get all links and recipients from valid triggers
	 * generate slack blocks
	 */
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
				accum.links.push(curr.body.link);
				if (curr.body.recipient?.slack) {
					accum.recipients.push(
						[
							curr.body.recipient.emoji || undefined,
							`<@${curr.body.recipient.slack.trim()}>`,
						].filter((r) => !!r).join(' '),
					);
				}

				return accum;
			}, {
				links: [],
				recipients: [],
			} as { links: string[]; recipients: string[] });

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

			const blocks = [
				{
					type: 'section',
					text: {
						type: 'mrkdwn',
						text: title,
					},
				},
				{
					type: 'section',
					text: {
						type: 'mrkdwn',
						text: '```' + contents.links.join('\n') + '```',
					},
				},
			] as SlackBlock[];

			if (!isEmpty(contents.recipients)) {
				blocks.push(
					{
						type: 'section',
						text: {
							type: 'mrkdwn',
							text: `cc: ${contents.recipients.join(', ')}`,
						},
					},
				);
			}

			return {
				blocks,
				triggers: triggers,
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

	// add header message to slack message blocks
	if (!isEmpty(slackMessageBlocks)) {
		const blocks = [
			{
				type: 'section',
				text: {
					type: 'mrkdwn',
					text: `:john_alert:  *Quick Check* :john_alert:`,
				},
			},
			{ type: 'divider' },
			...slackMessageBlocks,
			{ type: 'divider' },
			{
				type: 'section',
				text: {
					type: 'mrkdwn',
					text:
						'_Note: Cards status above will be recheck after 30 minutes_',
				},
			},
			{ type: 'divider' },
			{
				type: 'section',
				text: {
					type: 'mrkdwn',
					text: 'cc: <@U01FV9A3JK0> <@UFYD1NRGE>',
				},
			},
		] as SlackBlock[];
		console.log({
			channel: Deno.env.get('CHANNEL_ID') as string,
			text: 'Quest Check',
			blocks: blocks,
		});
		slackClient.chat.postMessage({
			channel: Deno.env.get('CHANNEL_ID') as string,
			text: 'Quest Check',
			blocks: blocks,
		});
		// should send slack message
	}
	lastTrigger = {
		lastTriggerAt: DateTime.now().toISO() as string,
		triggers: slackMessageBlocks,
	};
	console.log('lastTrigger', lastTrigger);
	// update lastTriggeredAt for each trigger
	await Bluebird.map(result, async (res) => {
		await Bluebird.map(res.triggers, async (t) => {
			await addTrigger({
				...t,
				lastTriggeredAt: DateTime.now().toISO() as string,
			});
		}, { concurrency: 20 });
	});
}
