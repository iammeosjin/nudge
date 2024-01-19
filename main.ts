import '$std/dotenv/load.ts';
// @deno-types=npm:@types/bluebird
import Bluebird from 'npm:bluebird';
// @deno-types=npm:@types/luxon
import { DateTime } from 'npm:luxon';
import toPairs from 'https://deno.land/x/ramda@v0.27.2/source/toPairs.js';
import groupBy from 'https://deno.land/x/ramda@v0.27.2/source/groupBy.js';
import concat from 'https://deno.land/x/ramda@v0.27.2/source/concat.js';
import consumeJiraIssues from './libs/consume-jira-issues.ts';
import consumeGithubPullRequests from './libs/consume-github-pull-requests.ts';
import { ID, SlackBlock, Team, Trigger, TriggerType } from './types.ts';
import { GITHUB_REPOSITORIES } from './libs/constants.ts';
import TriggerModel from './models/trigger.ts';
import isEmpty from 'https://deno.land/x/ramda@v0.27.2/source/isEmpty.js';

const cache = new Map<string, Promise<Trigger | null>>();

function getTrigger(id: ID) {
	const key = id.join('-');
	let trigger = cache.get(key);
	if (!trigger) {
		trigger = TriggerModel.get(id);
		cache.set(key, trigger);
	}

	return trigger;
}

function addTrigger(trigger: Trigger) {
	const key = trigger.id.join('-');
	const promise = (async () => {
		await TriggerModel.insert(trigger);
		return trigger;
	})();
	cache.set(key, promise);

	return promise;
}

// get all triggers and merge them
const triggers: Trigger[] = concat(
	await consumeJiraIssues({ triggers: [] }).then((res) => res.triggers),
	await consumeGithubPullRequests({ triggers: [] }, {
		...GITHUB_REPOSITORIES[Team.NEXIUX],
	}).then((res) => res.triggers),
);

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

				const maxDiffInMinutes = 30;

				/*
				allow trigger to have differ alert gaps based on trigger type
				if (trigger.type === TriggerType.T1) {
					maxDiffInMinutes = 60;
				}
				*/

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
			accum.recipients.push(curr.body.recipient);
			return accum;
		}, {
			links: [],
			recipients: [],
		} as { links: string[]; recipients: string[] });
		let title: string | undefined;
		if (type === TriggerType.T1) {
			title = 'Tasks are ready to be tested by our QAs';
		} else if (type === TriggerType.T2) {
			title = 'All subtasks are done';
		}
		if (type === TriggerType.T3) {
			title = 'Pull request is in stale for more than 5 minutes';
		}
		if (type === TriggerType.T4) {
			title = 'Kindly close before the day ends';
		}
		if (type === TriggerType.T5) {
			title = 'These should be in In Progress status';
		}
		if (type === TriggerType.T6) {
			title = 'Are we sure these tasks are ready for testing?';
		}

		return {
			blocks: [
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
				{
					type: 'section',
					text: {
						type: 'mrkdwn',
						text: `cc: ${contents.recipients.join(', ')}}`,
					},
				},
			] as SlackBlock[],
			triggers: triggers,
		};
	},
	{ concurrency: 20 },
);

const slackMessageBlocks = result.reduce((accum: SlackBlock[], curr) => {
	if (isEmpty(curr.blocks)) return accum;

	if (isEmpty(accum)) return curr.blocks;

	return [
		...accum,
		{ type: 'divider' },
		...curr.blocks,
	];
}, []);

if (!isEmpty(slackMessageBlocks)) {
	console.log(slackMessageBlocks);
	// send slack message
}

await Bluebird.map(result, async (res) => {
	await Bluebird.map(res.triggers, async (t) => {
		await addTrigger({
			...t,
			lastTriggeredAt: DateTime.now().toISO() as string,
		});
	}, { concurrency: 20 });
});

await Bluebird.map(
	await TriggerModel.list(),
	(t) => TriggerModel.delete(t.id),
);
