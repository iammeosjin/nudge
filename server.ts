import '$std/dotenv/load.ts';
// @deno-types=npm:@types/bluebird
import Bluebird from 'npm:bluebird';

import JobModel from './models/job.ts';
import TriggerModel from './models/trigger.ts';
import { getLastTrigger } from './libs/process-triggers.ts';
import checkTriggersJob from './jobs/check-triggers.ts';
import { addJob } from './controllers/job.ts';

const users = await Deno.readTextFile('./db/users.json').then((content) =>
	JSON.parse(content)
);

// async function handleHttp(conn: Deno.Conn) {
// 	const httpConn = Deno.serveHttp(conn);
// 	for await (const requestEvent of httpConn) {
// 		const url = new URL(requestEvent.request.url);

// 		console.log(url.pathname);

// 		// Build and send the response
// 		const response = new Response(JSON.stringify(users, null, 2));
// 		await requestEvent.respondWith(response);
// 	}
// }

Deno.cron('check-triggers', '*/2 * * * *', async () => {
	await checkTriggersJob(['check-triggers']);
	// await Bluebird.map(
	// 	await TriggerModel.list(),
	// 	(t) => TriggerModel.delete(t.id),
	// );
});

Deno.cron('delete triggers', '0 1 * * *', async () => {
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

	if (req.method === 'POST' && url.pathname === '/callback/slack') {
		console.log(await req.formData());
		return new Response(undefined, { status: 200 });
	}

	if (url.searchParams.get('token') !== '123') {
		return new Response(null, { status: 401 });
	}

	if (req.method === 'GET' && url.pathname === '/api/jobs') {
		return new Response(JSON.stringify(await JobModel.list(), null, 2));
	}

	if (req.method === 'POST' && url.pathname === '/api/jobs') {
		const body = await req.json();
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
			(t) => TriggerModel.delete(t.id),
		);
		return new Response('OK');
	}
	return new Response(JSON.stringify(users, null, 2));
});
