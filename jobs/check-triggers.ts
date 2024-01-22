import { addJob, getJob } from '../controllers/job.ts';
import processTriggers from '../libs/process-triggers.ts';
import { ID } from '../types.ts';

export default async function checkTriggersJob(id: ID) {
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
	console.log(`Job ${id.join('-')} took ${Date.now() - start}ms`);

	await addJob({
		id,
		status: 'READY',
	});
}
