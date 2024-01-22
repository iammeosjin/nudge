import JobModel from '../models/job.ts';
import { ID, Job } from '../types.ts';

const cache = new Map<string, Promise<Job | null>>();

export function getJob(id: ID) {
	const key = id.join('-');
	let trigger = cache.get(key);
	if (!trigger) {
		trigger = JobModel.get(id);
		cache.set(key, trigger);
	}

	return trigger;
}

export function addJob(job: Job) {
	const key = job.id.join('-');
	const promise = (async () => {
		await JobModel.insert(job);
		return job;
	})();
	cache.set(key, promise);

	return promise;
}
