import checkTriggersJob from './jobs/check-triggers.ts';
import JobModel from './models/job.ts';
import TriggerModel from './models/trigger.ts';
// @deno-types=npm:@types/bluebird
import Bluebird from 'npm:bluebird';

await JobModel.insert({
	id: ['check-triggers'],
	status: 'READY',
});

Deno.cron('check-triggers', '*/2 * * * *', async () => {
	await checkTriggersJob(['check-triggers']);
	await Bluebird.map(
		await TriggerModel.list(),
		(t) => TriggerModel.delete(t.id),
	);
});

// delete task model to remove cache
