import '$std/dotenv/load.ts';

const users = await Deno.readTextFile('./db/users.json').then((content) =>
	JSON.parse(content)
);

Deno.serve(() => new Response(JSON.stringify(users, null, 2)));
