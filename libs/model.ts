import { ID, KVEntry } from '../types.ts';
import KV from './kv.ts';

export default class DefaultModel<T> {
	get kv() {
		return KV;
	}

	getPrefix() {
		return 'default';
	}

	async get(key: ID) {
		const { value } = await KV.get([this.getPrefix(), ...key]);
		return value as T | null;
	}

	async delete(key: ID) {
		await KV.delete([this.getPrefix(), ...key]);
		return true;
	}

	async insert(input: KVEntry & T, options: { ttl?: number } = {}) {
		const key = [this.getPrefix(), ...input.id];
		const res = await KV.set(key, input, { expireIn: options.ttl });
		return res.ok;
	}

	async list(params?: { prefix: ID }) {
		const filter: { prefix: ID } = { prefix: [this.getPrefix()] };
		if (params?.prefix) {
			filter.prefix.push(...params.prefix);
		}
		const entries: (KVEntry & T)[] = [];
		for await (
			const entry of KV.list<KVEntry & T>(filter)
		) {
			entries.push(entry.value);
		}
		return entries;
	}
}
