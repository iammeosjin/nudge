import whereEq from 'https://deno.land/x/ramda@v0.27.2/source/whereEq.js';
import { User } from '../types.ts';

const users: User[] = await Deno.readTextFile('./db/users.json').then((
	content,
) => JSON.parse(content));

export default function getUser(filter?: Partial<User>) {
	return users.find((user) => whereEq(filter, user));
}
