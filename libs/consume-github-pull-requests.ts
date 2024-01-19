// @deno-types=npm:@types/luxon
import { DateTime } from 'npm:luxon';
// @deno-types=npm:@types/bluebird
import Bluebird from 'npm:bluebird';
import { PullRequest, Trigger, TriggerType } from '../types.ts';
import { GithubAPI, GithubRequestOptions } from '../apis/github.ts';
import { TIMEZONE } from './constants.ts';
import getUser from './get-user.ts';

type ProcessedResult = {
	triggers: Trigger[];
};

/*
 * T1: when all subtasks are done but the acceptance testing card still in "backlog" status
 * T2: when all subtasks are done including the acceptance testing but the parent card still in "In Progress" status
 * T3: when pull request is in stale for more than 5 minutes
 * T4: when there are pending pull request or subtasks on the closing hours
 * T5: when there are parent card that are not in progress status but have children that are already in progress
 * T6: when there are acceptance testing that are in ready or in progress but other subtask are not done yet
 */

export default async function consumeGithubPullRequests(
	result: ProcessedResult,
	options: GithubRequestOptions,
) {
	const response = await GithubAPI.getPullRequests({
		...options,
		first: options?.first || 100,
	});

	result.triggers = await Bluebird.reduce(
		response.pullRequests,
		(acc: Trigger[], pr: PullRequest) => {
			if (pr.merged) return acc;
			const trigger = {
				link: pr.permalink,
				key: pr.headRefName,
				recipient: getUser({ github: pr.author }),
			};
			const now = DateTime.now().setZone(TIMEZONE);
			if (
				Math.floor(
					Math.abs(
						DateTime.fromISO(pr.updatedAt, { zone: TIMEZONE })
							.diffNow('minutes').minutes,
					),
				) > 5
			) {
				acc.push({
					id: [pr.headRefName],
					type: TriggerType.T3,
					body: trigger,
				});
			}

			if (now.hour >= 17 && now.minute >= 30) {
				acc.push({
					id: [pr.headRefName],
					type: TriggerType.T4,
					body: trigger,
				});
			}

			return acc;
		},
		result.triggers,
	);

	if (response.hasNextPage && response.endCursor) {
		return consumeGithubPullRequests(result, {
			...options,
			after: response.endCursor as string,
		});
	}

	return result;
}
