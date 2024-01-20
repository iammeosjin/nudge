import processTriggers from '../libs/process-triggers.ts';
import JobModel from '../models/job.ts';
import { ID } from '../types.ts';

export default async function checkTriggersJob(id: ID) {
	const job = await JobModel.get(id);
	if (!job) return;
	if (job.status !== 'READY') return;

	await JobModel.insert({
		id,
		status: 'RUNNING',
	});

	const start = Date.now();
	await processTriggers();
	console.log(`Job ${id.join('-')} took ${Date.now() - start}ms`);

	await JobModel.insert({
		id,
		status: 'READY',
	});
}
