import '$std/dotenv/load.ts';
// @deno-types=npm:@types/bluebird
import Bluebird from 'npm:bluebird';
import JobModel from './models/job.ts';
import TriggerModel from './models/trigger.ts';
import { getLastTrigger } from './libs/process-triggers.ts';
import { addJob } from './controllers/job.ts';
import getUser from './libs/get-user.ts';
import jiraIssuesLoader from './libs/dataloaders/jira-issues-loader.ts';
import { getUserIssueSummary } from './libs/get-user-issue-summary.ts';
import {
	addTrigger,
	deleteTrigger,
	getTrigger,
} from './controllers/trigger.ts';
import sendSlackResponse from './libs/send-slack-response.ts';
import checkTriggersJob from './jobs/check-triggers.ts';

const users = await Deno.readTextFile('./db/users.json').then((content) =>
	JSON.parse(content)
);

Deno.cron('check-triggers', '*/2 * * * *', async () => {
	await checkTriggersJob(['check-triggers']);
	// await Bluebird.map(
	// 	await TriggerModel.list(),
	// 	(t) => TriggerModel.delete(t.id),
	// );
});

Deno.cron('delete triggers', '0 16 * * *', async () => {
	await Bluebird.map(
		await TriggerModel.list(),
		(t) => TriggerModel.delete(t.id),
	);
});

Deno.serve(async (req) => {
	const url = new URL(req.url);

	if (req.method === 'GET' && url.pathname === '/callback/jira') {
		return new Response('JIRA Response');
	}

	if (req.method === 'GET' && url.pathname === '/callback/github') {
		return new Response('JIRA Response');
	}

	if (
		req.method === 'POST' && url.pathname === '/callback/slack/interactive'
	) {
		const payload = JSON.parse(
			(await req.formData()).get('payload') as string,
		);
		if (
			!payload.token ||
			payload.token !== Deno.env.get('SLACK_COMMAND_TOKEN')
		) {
			return new Response(undefined, { status: 401 });
		}

		(async () => {
			if (payload.type !== 'block_actions') {
				return new Response(undefined, {
					status: 200,
				});
			}

			const action = payload.actions[0];
			if (action.action_id !== 'snooze-trigger') {
				return new Response(undefined, {
					status: 200,
				});
			}
			const trigger = await getTrigger(action.value.split('-'));

			if (!trigger) {
				return new Response(undefined, {
					status: 200,
				});
			}

			const responseURL = payload.response_url as string;

			if (
				!['UFYD1NRGE', 'U01FV9A3JK0'].includes(payload.user.id) &&
				trigger.body?.recipient?.slack !== payload.user.id
			) {
				if (responseURL) {
					await sendSlackResponse(responseURL, [
						{
							'type': 'context',
							'elements': [
								{
									'type': 'mrkdwn',
									'text':
										`:warning:  Invalid permission for *${action.value}*`,
								},
							],
						},
					]);
				}
				return new Response(undefined, {
					status: 200,
				});
			}

			await addTrigger({ ...trigger, snoozed: true });
			if (responseURL) {
				await sendSlackResponse(responseURL, [
					{
						'type': 'context',
						'elements': [
							{
								'type': 'mrkdwn',
								'text':
									`:white_check_mark: Snoozed notification for *${action.value}* for 24 hours`,
							},
						],
					},
				]);
			}

			return new Response(undefined, {
				status: 200,
			});
		})();

		return new Response(undefined, {
			status: 200,
		});
	}

	if (req.method === 'POST' && url.pathname === '/callback/slack') {
		const body = await req.formData();
		console.log('slack', body);
		if (
			!body.get('token') ||
			body.get('token') !== Deno.env.get('SLACK_COMMAND_TOKEN')
		) {
			return new Response(undefined, { status: 401 });
		}
		if (!body.get('response_url')) {
			return new Response(undefined, {
				status: 200,
			});
		}
		const user = getUser({ slack: body.get('user_id') as string });

		if (!user?.jira) return new Response(undefined, { status: 200 });
		(async () => {
			const issues = await jiraIssuesLoader.load(user?.jira as string);
			console.log('issues', issues);
			await getUserIssueSummary({
				issues,
				url: body.get('response_url') as string,
			});
		})();
		return new Response(undefined, {
			status: 200,
		});
	}

	if (url.searchParams.get('token') !== '123') {
		return new Response(null, { status: 401 });
	}

	if (req.method === 'GET' && url.pathname === '/api/jobs') {
		return new Response(JSON.stringify(await JobModel.list(), null, 2));
	}

	if (req.method === 'POST' && url.pathname === '/api/jobs') {
		const body = await req.json();
		console.log('update-jobs', body);
		await addJob(body);
		return new Response('OK');
	}

	if (req.method === 'GET' && url.pathname === '/api/triggers') {
		return new Response(JSON.stringify(await TriggerModel.list(), null, 2));
	}

	if (req.method === 'GET' && url.pathname === '/api/last-trigger') {
		return new Response(JSON.stringify(getLastTrigger(), null, 2));
	}
	if (req.method === 'DELETE' && url.pathname === '/api/triggers') {
		await Bluebird.map(
			await TriggerModel.list(),
			(t) => deleteTrigger(t.id),
		);
		return new Response('OK');
	}
	return new Response(JSON.stringify(users, null, 2));
});

/*
{
  "type": "block_actions",
  "user": {
    "id": "UFYD1NRGE",
    "username": "iammeosjin",
    "name": "iammeosjin",
    "team_id": "TFCKF6UTV"
  },
  "api_app_id": "A06ETF6CLFP",
  "token": "C0mtQe60B8RuFAyfeHS9pmmB",
  "container": {
    "type": "message",
    "message_ts": "1707562381.773929",
    "channel_id": "C02T233MQFL",
    "is_ephemeral": false
  },
  "trigger_id": "6618988948066.522661232947.b83c04e417e9d984415cb6f3cf47c6c3",
  "team": {
    "id": "TFCKF6UTV",
    "domain": "highoutput"
  },
  "enterprise": null,
  "is_enterprise_install": false,
  "channel": {
    "id": "C02T233MQFL",
    "name": "privategroup"
  },
  "state": {
    "values": {}
  },
  "response_url": "https://hooks.slack.com/actions/TFCKF6UTV/6616068022053/WG45KtHDIBhu5tDVG5iR2L1Z",
  "actions": [
    {
      "action_id": "snooze-trigger",
      "block_id": "XWnVo",
      "text": {
        "type": "plain_text",
        "text": "Snooze",
        "emoji": true
      },
      "value": "ROW-7106",
      "type": "button",
      "action_ts": "1707564434.026452"
    }
  ]
}
*/
