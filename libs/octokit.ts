import { Octokit } from 'npm:octokit';

const auth = Deno.env.get('GITHUB_TOKEN');
const octokit = new Octokit({
	auth: auth,
});

export default octokit;
