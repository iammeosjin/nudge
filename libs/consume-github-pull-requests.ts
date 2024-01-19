// @deno-types=npm:@types/luxon
import { DateTime } from 'npm:luxon';
// @deno-types=npm:@types/bluebird
import Bluebird from 'npm:bluebird';
import { PullRequest } from '../types/pull-request.ts';
import { GithubAPI, GithubRequestOptions } from '../apis/github.ts';
import { TIMEZONE } from './constants.ts';

type ProcessedResult = {
	triggers: PullRequest[];
};

/*
 * A1: when all subtasks are done but the acceptance testing card still in "backlog" status
 * A2: when all subtasks are done including the acceptance testing but the parent card still in "In Progress" status
 * A3: when pull request is in stale for more than 5 minutes
 * A4: when there are pending pull request or subtasks on the closing hours
 * A5: when there are parent card that are not in progress status but have children that are already in progress
 * A6: when there are acceptance testing that are in ready or in progress but other subtask are not done yet
 */

export default async function consumeGithubPullRequests(
	result: ProcessedResult,
	options: GithubRequestOptions,
) {
	const response = await GithubAPI.getPullRequests(options);

	result.triggers = await Bluebird.reduce(
		response.pullRequests,
		(acc: PullRequest[], pr: PullRequest) => {
			if (pr.merged) return acc;

			if (
				Math.floor(
					Math.abs(
						DateTime.fromISO(pr.updatedAt, { zone: TIMEZONE })
							.diffNow('minutes').minutes,
					),
				) > 5
			) {
				console.log('A3', pr);
				acc.push(pr);
			}

			return acc;
		},
		result.triggers,
	);

	if (response.hasNextPage && response.startCursor) {
		return consumeGithubPullRequests(result, {
			...options,
			after: response.endCursor as string,
		});
	}

	return result;
}
