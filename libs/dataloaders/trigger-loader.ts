import Dataloader from 'npm:dataloader';
import { ID, Trigger } from '../../types.ts';
import TriggerModel from '../../models/trigger.ts';
import triggerCache from '../trigger-cache.ts';

const loader = async (
	ids: readonly ID[],
) => {
	const issues = await TriggerModel.list();
	issues.map((issue) =>
		triggerCache.set(issue.id.join('-'), Promise.resolve(issue))
	);
	return ids.map((key) => {
		return issues.find((issue) =>
			issue.id.join('-') === key.join('-')
		) as Trigger;
	});
};

const triggerDataLoader = new Dataloader<ID, Trigger | null>(loader);

export default triggerDataLoader;
