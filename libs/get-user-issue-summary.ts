// @deno-types=npm:@types/luxon
import { DateTime } from 'npm:luxon';
import { Issue, JiraIssueType, JiraStatus, SlackBlock } from '../types.ts';
import getTriggers from './get-triggers.ts';
import { TIMEZONE } from './constants.ts';
import formatTime from './format-time.ts';
import generateSlackBlocks from './generate-slack-block.ts';

export async function getUserIssueSummary(params: {
	issues: Issue[];
	url: string;
}) {
	const { triggers, issues: issueBreakdowns } = await getTriggers(
		params.issues,
	);
	const issuesText = issueBreakdowns.map((issue) => {
		const dateDifference = formatTime(Math.abs(
			DateTime.fromISO(
				issue.statusCategoryChangeDate,
			).setZone(TIMEZONE).diffNow('seconds').seconds,
		));

		if (issue.devCards?.length) {
			const summary = issue.devCards.reduce((acc, curr) => {
				if (curr.status === JiraStatus.IN_PROGRESS) acc.inProgress++;
				if (
					curr.status === JiraStatus.DONE ||
					curr.status === JiraStatus.CANCELED
				) acc.done++;
				if (curr.status === JiraStatus.READY) acc.ready++;
				if (curr.status === JiraStatus.BACKLOG) acc.backlog++;
				if (curr.type === JiraIssueType.DEFECT) acc.defect++;
				return acc;
			}, { inProgress: 0, done: 0, ready: 0, backlog: 0, defect: 0 });
			return [
				`${
					100 - issue.devCards.length / (summary.done || 1)
				}% *${issue.key}* - ${issue.summary}`,
				`${summary.inProgress} already in progress`,
				`>${summary.ready} ready for development`,
				`>${summary.backlog} in backlog`,
				`>with ${summary.defect} defects`,
			].join('\n');
		} else if (!issue.subTasks?.length) {
			if (issue.status === JiraStatus.IN_PROGRESS) {
				return [
					`*${issue.key}* - ${issue.summary}`,
					`>in progress for ${dateDifference}`,
				].join('\n');
			}

			return [
				`*${issue.key}* - ${issue.summary}`,
				`>in ready for ${dateDifference} - move to backlog or in progress to avoid being stale`,
			].join('\n');
		} else if (issue.atCards?.length) {
			return issue.atCards.map((card) => {
				if (card.status === JiraStatus.DONE) return null;
				if (card.status === JiraStatus.BACKLOG) return null;

				if (issue.status === JiraStatus.IN_PROGRESS) {
					return [
						`*${issue.key}* - ${issue.summary}`,
						`>in progress for ${dateDifference}`,
					].join('\n');
				}

				return [
					`*${issue.key}* - ${issue.summary}`,
					`>in ready for ${dateDifference} - follow up this to SQA so it can be tested`,
				].join('\n');
			}).filter((index) => !!index).join('\n');
		}

		return null;
	}).filter((index) => !!index).join('\n');
	const result = await generateSlackBlocks(triggers);
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
				text: issuesText,
			},
		},
		{ type: 'divider' },
	] as SlackBlock[];
	console.log('blocks', blocks);
	if (Deno.env.get('ENVIRONMENT')) {
		const response = await fetch(params.url, {
			method: 'POST',
			body: JSON.stringify({
				text: 'Here are your issues',
				blocks: blocks,
				replace_original: true,
			}),
		});
		console.log('test', response.status, await response.text());
	}
}
