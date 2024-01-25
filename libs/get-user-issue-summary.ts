// @deno-types=npm:@types/luxon
import { DateTime } from 'npm:luxon';
import { Issue, JiraIssueType, JiraStatus, SlackBlock } from '../types.ts';
import getTriggers from './get-triggers.ts';
import { TIMEZONE } from './constants.ts';
import formatTime from './format-time.ts';
import generateSlackBlocks from './generate-slack-block.ts';
import isEmpty from 'https://deno.land/x/ramda@v0.27.2/source/isEmpty.js';

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

		const link = `https://identifi.atlassian.net/browse/${issue.key}`;

		if (issue.subTasks?.length) {
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

			let atCardsText = undefined;
			if (issue.atCards?.length) {
				atCardsText = issue.atCards.map((card) => {
					if (card.status !== JiraStatus.READY) return null;
					const title =
						`*<${`https://identifi.atlassian.net/browse/${card.key}`}|${card.key} - ${card.summary}>*`;
					return [
						title,
						`>in ready - follow up this to SQA so it can be tested`,
					].join('\n');
				}).filter((index) => !!index).join('\n');
			}

			return [
				`*<${link}|${
					(((summary.done > issue.devCards.length
						? issue.devCards.length
						: summary.done) / (issue.devCards.length || 1)) * 100)
						.toFixed(
							2,
						)
				}% ${issue.key} - ${issue.summary}>*`,
				summary.inProgress
					? `>${summary.inProgress} already in progress`
					: undefined,
				summary.ready
					? `>${summary.ready} ready for development`
					: undefined,
				summary.backlog ? `>${summary.backlog} in backlog` : undefined,
				summary.defect
					? `>with ${summary.defect} defects (overall)`
					: undefined,
				`>in ${dateDifference}`,
				atCardsText,
			].filter((text) => !!text).join('\n');
		}

		const title = `*<${link}|${issue.key} - ${issue.summary}>*`;
		if (issue.status === JiraStatus.IN_PROGRESS) {
			return [
				title,
				`>in progress for ${dateDifference}`,
			].join('\n');
		}

		return [
			title,
			`>in ready for ${dateDifference} - move to backlog or in progress to avoid being stale`,
		].join('\n');
	}).filter((index) => !!index).join('\n');
	const result = await generateSlackBlocks(triggers);
	const blocks = [
		{
			type: 'section',
			text: {
				type: 'mrkdwn',
				text: `*Here is your summary* :pencil:`,
			},
		},
	] as SlackBlock[];

	if (!isEmpty(result.blocks)) {
		blocks.push({ type: 'divider' });
		blocks.push(...result.blocks);
	}

	if (issuesText.trim()) {
		blocks.push({ type: 'divider' });
		blocks.push({
			type: 'section',
			text: {
				type: 'mrkdwn',
				text: issuesText,
			},
		});
	}

	if (Deno.env.get('ENVIRONMENT')) {
		const response = await fetch(params.url, {
			method: 'POST',
			body: JSON.stringify({
				text: 'Hatdoooooog',
				blocks: blocks,
				replace_original: true,
			}),
		});
		console.log('send-slack', response.status, await response.text());
	}
}
