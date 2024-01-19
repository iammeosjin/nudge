/// <reference lib="deno.unstable" />

export default await Deno.openKv(
	Deno.env.get('ENVIRONMENT') === 'development' ? undefined : './db/local',
);
