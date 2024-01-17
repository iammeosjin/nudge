// @deno-types=npm:@types/luxon
import pick from 'https://deno.land/x/ramda@v0.27.2/source/pick.js';
import jiraClient from '../libs/jira-client.ts';
import {
	JiraChangeLogResponse,
	JiraIssueFieldsResponse,
	JiraIssueType,
	JiraRequestOptions,
	JiraStatus,
	JiraTask,
	NudgeCriteria,
} from '../types/task.ts';

const issueTypes = {
	'10000': 'EPIC',
	'10001': 'STORY',
	'10002': 'TASK',
	'10003': 'SUBTASK',
	'10004': 'BUG',
	'10260': 'TASK',
	'10261': 'EPIC',
	'10263': 'BUG',
	'10264': 'STORY',
	'10266': 'SUBTASK',
	'10282': 'DEFECT',
	'10315': 'DEFECT',
	'10355': 'BASIC_TASK',
} as Record<string, JiraIssueType>;

export class JiraAPI {
	static async getIssues(
		options?: Partial<JiraRequestOptions>,
	): Promise<
		JiraRequestOptions & {
			issues: JiraTask[];
		}
	> {
		const query = [
			'project = "ROW"',
			`status = "In Progress" and type in (Bug, Story, standardIssueTypes())`,
		].filter((index) => !!index).join(' AND ');

		const jql =
			`${query} ORDER BY created DESC, resolved DESC, status DESC, updated DESC`;

		const result = await jiraClient.searchJira(
			jql,
			{
				maxResults: options?.maxResults || 10000,
				startAt: options?.startAt,
				expand: ['changelog'],
				fields: [
					'parent',
					'issuetype',
					'assignee',
					'statuscategorychangedate',
					'created',
					'updated',
					'status',
					'subtasks',
				],
			},
		) as JiraRequestOptions & {
			issues: {
				key: string;
				changelog: JiraChangeLogResponse;
				fields: JiraIssueFieldsResponse;
			}[];
		};

		const issues: JiraTask[] = result.issues
			.map((issue) => {
				let parent: JiraTask['parent'] | undefined;
				const parentId = issue.fields.parent?.fields.issuetype.id;
				if (parentId) {
					parent = {
						key: issue.fields.parent?.key as string,
						status: issue.fields.parent?.fields.status
							.name as JiraStatus,
						type: issueTypes[parentId],
					};
				}
				// const movedToInProgress = issue.changelog.histories.find(
				// 	(history) =>
				// 		history.items.some((item) =>
				// 			item.field === 'status' &&
				// 			item.toString === 'In Progress'
				// 		),
				// )?.created as string;

				const acceptanceTestingCard = (issue.fields?.subtasks || [])
					.find((task) =>
						(task.fields.summary || '').match(
							/\bAcceptance Testing\b/,
						)
					);

				const inProgressDevCards = (issue.fields?.subtasks || []).find((
					task,
				) => !(task.fields.summary || '').match(
					/\bAcceptance Testing\b/,
				) && task.fields.status.name !== 'Done' &&
					task.fields.status.name !== 'Canceled'
				);

				let criteria: NudgeCriteria = {
					cardStatus: issue.fields.status.name as JiraStatus,
					hasATCard: !!acceptanceTestingCard,
					aTCardStatus: acceptanceTestingCard?.fields.status
						.name as JiraStatus,
					devCardsDone: !inProgressDevCards,
				};

				return {
					key: issue.key,
					assignee: issue.fields?.assignee?.accountId,
					assigneeName: issue.fields?.assignee?.displayName,
					hasSubtask: (issue.fields?.subtasks || []).length > 0,
					type: issueTypes[
						issue.fields?.issuetype?.id
					],
					parent,
					created: issue.fields?.created,
					updated: issue.fields?.updated,
					status: issue.fields?.status?.name as JiraStatus,
					criteria,
				};
			});

		return {
			...pick(['startAt', 'maxResults', 'total'])(result),
			issues,
		};
	}
}
