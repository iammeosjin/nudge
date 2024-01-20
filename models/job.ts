import DefaultModel from '../libs/model.ts';
import { Job } from '../types.ts';

class Model extends DefaultModel<Job> {
	getPrefix() {
		return 'job';
	}
}

const JobModel = new Model();

export default JobModel;
