import { SlackAPIClient } from 'https://deno.land/x/slack_web_api_client@0.7.6/mod.ts';

const slackClient = new SlackAPIClient(
	Deno.env.get('SLACK_TOKEN') as string,
);

export default slackClient;
