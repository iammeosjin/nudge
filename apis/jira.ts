import pick from 'https://deno.land/x/ramda@v0.27.2/source/pick.js';
import jiraClient from '../libs/jira-client.ts';
import {
	Issue,
	JiraChangeLogResponse,
	JiraIssueFieldsResponse,
	JiraIssueFilter,
	JiraIssueJobType,
	JiraIssueType,
	JiraRequestOptions,
	JiraStatus,
} from '../types.ts';

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

const jobTypes = {
	'Frontend': JiraIssueJobType.FRONTEND,
	'Backend': JiraIssueJobType.BACKEND,
} as Record<string, JiraIssueJobType>;

export class JiraAPI {
	static async getIssues(
		filter?: JiraIssueFilter,
		options?: Partial<JiraRequestOptions>,
	): Promise<
		JiraRequestOptions & {
			issues: Issue[];
		}
	> {
		let status = `(Ready, "In Progress")`;
		if (filter?.statuses?.length) {
			status = `(${filter.statuses.join(', ')})`;
		}

		let types = '(Bug, Story, standardIssueTypes())';
		if (filter?.types) {
			types = filter.types;
		}

		const query = [
			'project = "ROW"',
			`status IN ${status}`,
			`type in ${types}`,
			filter?.assignees?.length
				? `assignee in (${filter.assignees.join(', ')})`
				: undefined,
		].filter((index) => !!index).join(' AND ');

		const jql =
			`${query} ORDER BY created DESC, resolved DESC, status DESC, updated DESC`;

		console.log(jql);

		const result = await jiraClient.searchJira(
			jql,
			{
				maxResults: options?.maxResults || 10000,
				startAt: options?.startAt,
				expand: ['changelog'],
				fields: [
					'parent',
					'summary',
					'issuetype',
					'assignee',
					'reporter',
					'statuscategorychangedate',
					'created',
					'updated',
					'status',
					'subtasks',
					'customfield_10813',
				],
			},
		) as JiraRequestOptions & {
			issues: {
				key: string;
				changelog: JiraChangeLogResponse;
				fields: JiraIssueFieldsResponse;
			}[];
		};

		const issues: Issue[] = result.issues
			.map((issue) => {
				let parent: Issue['parent'] | undefined;
				const parentId = issue.fields.parent?.fields.issuetype.id;
				if (parentId) {
					parent = {
						key: issue.fields.parent?.key as string,
						status: issue.fields.parent?.fields.status
							.name as JiraStatus,
						type: issueTypes[parentId],
					};
				}

				const subTasks = (issue.fields?.subtasks || []).map((task) => {
					return {
						key: task.key,
						summary: task.fields.summary,
						status: task.fields?.status?.name as JiraStatus,
						type: issueTypes[task.fields?.issuetype?.id],
					};
				});

				return {
					key: issue.key,
					summary: issue.fields.summary,
					assignee: {
						id: issue.fields?.assignee?.accountId,
						displayName: issue.fields?.assignee?.displayName,
					},
					reporter: {
						id: issue.fields?.reporter?.accountId,
						displayName: issue.fields?.reporter?.displayName,
					},
					status: issue.fields?.status?.name as JiraStatus,
					type: issueTypes[
						issue.fields?.issuetype?.id
					],
					parent,
					subTasks,
					statusCategoryChangeDate: issue.fields
						?.statuscategorychangedate,
					jobType: issue.fields.customfield_10813?.value
						? jobTypes[issue.fields.customfield_10813.value]
						: undefined,
				};
			});

		return {
			...pick(['startAt', 'maxResults', 'total'])(result),
			issues,
		};
	}
}
