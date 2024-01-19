import '$std/dotenv/load.ts';
import consumeJiraIssues from './libs/consume-jira-issues.ts';

const triggers = await consumeJiraIssues({ triggers: [] });


