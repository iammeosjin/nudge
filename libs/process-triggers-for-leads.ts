import '$std/dotenv/load.ts';
// @deno-types=npm:@types/bluebird
import Bluebird from 'npm:bluebird';
// @deno-types=npm:@types/luxon
import { DateTime } from 'npm:luxon';
import { SlackBlock, Trigger, TriggerType, User } from '../types.ts';
import { addTrigger, deleteTrigger } from '../controllers/trigger.ts';
import slackClient from './slack-client.ts';
import generateSlackBlocks from './generate-slack-block.ts';
import consumeJiraSubTasks from './consume-jira-sub-tasks.ts';
import getUser from './get-user.ts';
import isEmpty from 'https://deno.land/x/ramda@v0.27.2/source/isEmpty.js';

/*
 * T1: when all subtasks are done but the acceptance testing card still in "backlog" status
 * T2: when all subtasks are done including the acceptance testing but the parent card still in "In Progress" status
 * T3: when pull request is in stale for more than 5 minutes
 * T4: when there are pending pull request or subtasks on the closing hours
 * T5: when there are parent card that are not in progress status but have children that are already in progress
 * T6: when there are acceptance testing that are in ready or in progress but other subtask are not done yet
 * T7: when there is no acceptance testing (disabled)
 * T8: when there is no tasks in tasks board for backend/frontend
 * T9: when there is no currently task assigned to BE devs
 * T10: when parent is in progress and all other subtasks are done but there are  backlogs
 */

export default async function processTriggersForLeads() {
	// get all triggers and merge them

	const { summary } = await consumeJiraSubTasks({
		summary: {
			frontendSubTasks: 0,
			backendSubTasks: 0,
			assignees: {},
		},
	});

	let t8Trigger: Trigger | undefined = undefined;

	if (summary.frontendSubTasks === 0 || summary.backendSubTasks === 0) {
		t8Trigger = {
			id: ['t10'],
			type: TriggerType.T10,
		};
	} else {
		deleteTrigger(['t10']);
	}

	if (t8Trigger) {
		const result = await generateSlackBlocks([t8Trigger]);
		if (!isEmpty(result.blocks)) {
			if (Deno.env.get('ENVIRONMENT')) {
				slackClient.chat.postMessage({
					channel: Deno.env.get('CHANNEL_ID') as string,
					text: 'Quest Check',
					blocks: result.blocks,
				});
			}
		}

		await Bluebird.map(result.triggers, async (t: Trigger) => {
			await addTrigger({
				...t,
				lastTriggeredAt: DateTime.now().toISO() as string,
			});
		}, { concurrency: 20 });
	}

	const users = await Promise.all(
		[
			getUser({ name: 'Ericson Sacdalan' }),
			getUser({ name: 'John Mark Bautista' }),
			getUser({ name: 'Klien Menard Luminarias' }),
		],
	).then((users) => users.filter((user) => !!user)) as User[];

	const triggers = users.map((user) => {
		const taskCount = summary.assignees[user.jira as string] || 0;
		if (taskCount === 0) {
			return {
				id: [user.jira as string],
				type: TriggerType.T9,
				body: {
					link: user.name,
				},
			};
		}
		return null;
	}).filter((trigger) => !!trigger) as Trigger[];

	const result = await generateSlackBlocks(triggers);
	if (!isEmpty(result.blocks)) {
		const blocks = [
			{
				type: 'section',
				text: {
					type: 'mrkdwn',
					text: `*Quick Check* <!here>`,
				},
			},
			{ type: 'divider' },
			...result.blocks,
			{ type: 'divider' },
			{
				type: 'section',
				text: {
					type: 'mrkdwn',
					text: 'kindly verify cc: <@U01FV9A3JK0> <@UFYD1NRGE>',
				},
			},
			{ type: 'divider' },
		] as SlackBlock[];
		if (Deno.env.get('ENVIRONMENT')) {
			slackClient.chat.postMessage({
				channel: Deno.env.get('LEADS_CHANNEL_ID') as string,
				text: 'Quest Check',
				blocks: blocks,
			});
		}
	}

	await Bluebird.map(result.triggers, async (t: Trigger) => {
		await addTrigger({
			...t,
			lastTriggeredAt: DateTime.now().toISO() as string,
		});
	}, { concurrency: 20 });
}
