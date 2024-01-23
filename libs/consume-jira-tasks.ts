import { JiraAPI } from '../apis/jira.ts';
import {
	JiraRequestOptions,
	JiraStatus,
	Trigger,
	TriggerType,
} from '../types.ts';
import isEmpty from 'https://deno.land/x/ramda@v0.27.2/source/isEmpty.js';
import * as uuid from 'https://deno.land/x/uuid@v0.1.2/mod.ts';
import getUser from './get-user.ts';
import { Task } from '../types.ts';

type ProcessedResult = {
	triggers: Trigger[];
};

/*
 * T8: there is tasks in the task board
 * T9: there is no task assigned to a BE dev
 */

export default async function consumeJiraTasks(
	result: ProcessedResult,
	options?: Partial<JiraRequestOptions>,
) {
	const response = await JiraAPI.getTasks(options);

	const checkAndTrigger = (
		tasks: Task[],
		status: Task['status'],
		jobType: Task['jobType'],
		assignee?: Task['assignee'],
	) => {
		const filteredTasks = tasks.filter(
			(task) =>
				task.status === status && task.jobType === jobType &&
				(!assignee || task.assignee === assignee),
		);

		if (isEmpty(filteredTasks)) {
			result.triggers.push({
				id: [uuid.V4.uuid()],
				type: assignee ? TriggerType.T9 : TriggerType.T8,
				body: {
					link:
						`https://identifi.atlassian.net/jira/software/c/projects/ROW/boards/158`,
					key: '',
					jobType,
					...assignee
						? { assignee: getUser({ jira: assignee }) }
						: undefined,
				},
			});
		}
	};

	checkAndTrigger(response.issues, JiraStatus.READY, 'Frontend');
	checkAndTrigger(response.issues, JiraStatus.READY, 'Backend');

	const beDevs = [
		'70121:bdbc5579-d911-4300-a559-0fdde913907b',
		'5fcfdbcecb350d006830c2b2',
		'5f98b79f048052006be65464',
	];
	beDevs.forEach((dev) => {
		checkAndTrigger(
			response.issues,
			JiraStatus.IN_PROGRESS,
			'Backend',
			dev,
		);
	});

	console.log(
		'JIRA page',
		response.startAt + response.maxResults,
		response.total,
	);
	if ((response.startAt + response.maxResults) < response.total) {
		return consumeJiraTasks(result, {
			...options,
			startAt: response.startAt + response.maxResults,
		});
	}

	return result;
}
