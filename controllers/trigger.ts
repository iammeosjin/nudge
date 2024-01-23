import TriggerModel from '../models/trigger.ts';
import { ms } from 'https://raw.githubusercontent.com/denolib/ms/master/ms.ts';
import { ID, Trigger } from '../types.ts';

const cache = new Map<string, Promise<Trigger | null>>();

export function getTrigger(id: ID) {
	const key = id.join('-');
	let trigger = cache.get(key);
	if (!trigger) {
		trigger = TriggerModel.get(id);
		cache.set(key, trigger);
	}

	return trigger;
}

export function addTrigger(trigger: Trigger) {
	const key = trigger.id.join('-');
	const promise = (async () => {
		await TriggerModel.insert(trigger, { ttl: ms('1h') as number });
		return trigger;
	})();
	cache.set(key, promise);

	return promise;
}

export function deleteTrigger(id: ID) {
	const key = id.join('-');
	cache.delete(key);
	return TriggerModel.delete(id);
}
