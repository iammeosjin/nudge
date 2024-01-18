import { Issue, JiraRequestOptions } from '../types/task.ts';

export default async function jiraIssuesConsumer<T>(
	jiraCallBack: (options?: Partial<JiraRequestOptions>) => Promise<
		JiraRequestOptions & {
			issues: Issue[];
		}
	>,
	handler: (doc: Issue | Issue[]) => Promise<void>,
	batchSize = 1,
) {
	let processor = (doc?: Issue) => {
		if (!doc) {
			return undefined;
		}

		return handler(doc);
	};

	if (batchSize > 1) {
		processor = (() => {
			let buffer: Issue[] = [];

			return async (doc?: Issue) => {
				if (!doc) {
					if (!buffer.length) {
						return;
					}

					await handler(buffer);
					buffer = [];
					return;
				}

				buffer.push(doc);

				if (buffer.length >= batchSize) {
					await handler(buffer);
					buffer = [];
				}
			};
		})();
	}

	const processIssues = async (issues: Issue[]) => {
		for (const issue of issues) {
			await processor(issue);
		}
	};

	const jiraResponse = await jiraCallBack();

	const { startAt, maxResults, total } = jiraResponse;

	let currentPage = startAt + maxResults;

	processIssues(jiraResponse.issues);

	while (currentPage < total) {
		const nextPageResponse = await jiraCallBack({ startAt: currentPage });
		if (nextPageResponse) {
			processIssues(nextPageResponse.issues);
			currentPage += nextPageResponse.maxResults;
		}
	}

	await processor();
}
