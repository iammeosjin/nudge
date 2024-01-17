// @deno-types=npm:@types/jira-client
import JiraApi from 'npm:jira-client';

const jiraClient = new JiraApi({
	protocol: 'https',
	host: Deno.env.get('JIRA_HOST') as string,
	username: Deno.env.get('JIRA_EMAIL'),
	password: Deno.env.get('JIRA_TOKEN'),
	apiVersion: '2',
	strictSSL: true,
});

export default jiraClient;
