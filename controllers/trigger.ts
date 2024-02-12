import TriggerModel from '../models/trigger.ts';
import { ms } from 'https://raw.githubusercontent.com/denolib/ms/master/ms.ts';
import { ID, Trigger } from '../types.ts';
import triggerCache from '../libs/trigger-cache.ts';
import triggerDataLoader from '../libs/dataloaders/trigger-loader.ts';

export function getTrigger(id: ID) {
	const key = id.join('-');
	let trigger = triggerCache.get(key);
	if (!trigger) {
		trigger = triggerDataLoader.load(id);
		triggerCache.set(key, trigger);
	}

	return trigger;
}

export function addTrigger(trigger: Trigger) {
	const key = trigger.id.join('-');
	const promise = (async () => {
		await TriggerModel.insert(trigger, { ttl: ms('24h') as number });
		return trigger;
	})();
	triggerCache.set(key, promise);

	return promise;
}

export function deleteTrigger(id: ID) {
	const key = id.join('-');
	triggerCache.delete(key);
	return TriggerModel.delete(id);
}
