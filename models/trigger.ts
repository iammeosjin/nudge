import DefaultModel from '../libs/model.ts';
import { Trigger } from '../types.ts';

class Model extends DefaultModel<Trigger> {
	getPrefix() {
		return 'trigger';
	}
}

const TriggerModel = new Model();

export default TriggerModel;
