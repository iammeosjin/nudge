import '$std/dotenv/load.ts';
import concat from 'https://deno.land/x/ramda@v0.27.2/source/concat.js';
import consumeJiraIssues from './libs/consume-jira-issues.ts';
import consumeGithubPullRequests from './libs/consume-github-pull-requests.ts';
import { Team } from './types.ts';
import { GITHUB_REPOSITORIES } from './libs/constants.ts';

const triggers = concat(
	await consumeJiraIssues({ triggers: [] }).then((res) => res.triggers),
	await consumeGithubPullRequests({ triggers: [] }, {
		...GITHUB_REPOSITORIES[Team.NEXIUX],
	}).then((res) => res.triggers),
);

console.log(triggers);
