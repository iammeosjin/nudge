import { SlackBlock } from '../types.ts';

export default async function sendSlackResponse(
	url: string,
	blocks: SlackBlock[],
) {
	if (Deno.env.get('ENVIRONMENT')) {
		const response = await fetch(url, {
			method: 'POST',
			body: JSON.stringify({
				text: 'Hatdoooooog',
				blocks: blocks,
				replace_original: true,
			}),
		});
		console.log('send-slack', response.status, await response.text());
	}
}
