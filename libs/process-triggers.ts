import '$std/dotenv/load.ts';
// @deno-types=npm:@types/bluebird
import Bluebird from 'npm:bluebird';
// @deno-types=npm:@types/luxon
import { DateTime } from 'npm:luxon';
import concat from 'https://deno.land/x/ramda@v0.27.2/source/concat.js';
import consumeJiraIssues from './consume-jira-issues.ts';
import consumeJiraTasks from './consume-jira-tasks.ts';
import consumeGithubPullRequests from './consume-github-pull-requests.ts';
import { SlackBlock, Team, Trigger } from '../types.ts';
import { GITHUB_REPOSITORIES } from './constants.ts';
import isEmpty from 'https://deno.land/x/ramda@v0.27.2/source/isEmpty.js';
import { addTrigger } from '../controllers/trigger.ts';
import slackClient from './slack-client.ts';
import generateSlackBlocks from './generate-slack-block.ts';

let lastTrigger: { lastTriggerAt?: string; triggers?: SlackBlock[] } = {};

export function getLastTrigger() {
	console.log('getLastTrigger', lastTrigger);
	return lastTrigger;
}

/*
 * T1: when all subtasks are done but the acceptance testing card still in "backlog" status
 * T2: when all subtasks are done including the acceptance testing but the parent card still in "In Progress" status
 * T3: when pull request is in stale for more than 5 minutes
 * T4: when there are pending pull request or subtasks on the closing hours
 * T5: when there are parent card that are not in progress status but have children that are already in progress
 * T6: when there are acceptance testing that are in ready or in progress but other subtask are not done yet
 * T7: when there is no acceptance testing
 */

export default async function processTriggers() {
	// get all triggers and merge them
	const triggers: Trigger[] = concat(
		await consumeJiraIssues({ triggers: [] }).then((res) => res.triggers),
		await consumeJiraTasks({ triggers: [] }).then((res) => res.triggers),
		await consumeGithubPullRequests({ triggers: [] }, {
			...GITHUB_REPOSITORIES[Team.NEXIUX],
		}).then((res) => res.triggers),
	);

	const result = await generateSlackBlocks(triggers);

	/*
	 * group triggers by type
	 * map each group and check if the trigger is already triggered
	 * get all links and recipients from valid triggers
	 * generate slack blocks
	 */

	// add header message to slack message blocks
	if (!isEmpty(result.blocks)) {
		const blocks = [
			{
				type: 'section',
				text: {
					type: 'mrkdwn',
					text: `:john_alert:  *Quick Check* :john_alert:`,
				},
			},
			{ type: 'divider' },
			...result.blocks,
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
					text: 'kindly verify cc: <@U01FV9A3JK0> <@UFYD1NRGE>',
				},
			},
			{ type: 'divider' },
		] as SlackBlock[];
		if (Deno.env.get('ENVIRONMENT')) {
			slackClient.chat.postMessage({
				channel: Deno.env.get('CHANNEL_ID') as string,
				text: 'Quest Check',
				blocks: blocks,
			});
		}

		// should send slack message
	}
	lastTrigger = {
		lastTriggerAt: DateTime.now().toISO() as string,
		triggers: result.blocks,
	};
	console.log('lastTrigger', lastTrigger);
	// update lastTriggeredAt for each trigger
	await Bluebird.map(result.triggers, async (t: Trigger) => {
		await addTrigger({
			...t,
			lastTriggeredAt: DateTime.now().toISO() as string,
		});
	}, { concurrency: 20 });
}
