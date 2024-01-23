// @deno-types=npm:@types/luxon
import { DateTime } from 'npm:luxon';
import { addJob, getJob } from '../controllers/job.ts';
import processTriggers from '../libs/process-triggers.ts';
import { ID } from '../types.ts';
import { TIMEZONE } from '../libs/constants.ts';
import processTriggersForLeads from '../libs/process-triggers-for-leads.ts';

export default async function checkTriggersJob(id: ID) {
	const now = DateTime.now().setZone(TIMEZONE);
	console.log('job checks', now.hour, now.weekday);
	if (now.hour >= 19 || now.hour < 9) return;
	if (now.weekday > 5) return;
	const job = await getJob(id);
	console.log(`Running job ${id.join('-')}`, job);
	if (!job) return;
	if (job.status !== 'READY') return;

	await addJob({
		id,
		status: 'RUNNING',
	});

	const start = Date.now();
	await processTriggers();
	await new Promise((resolve) => setTimeout(resolve, 1000));
	await processTriggersForLeads();
	console.log(`Job ${id.join('-')} took ${Date.now() - start}ms`);

	await addJob({
		id,
		status: 'READY',
	});
}
