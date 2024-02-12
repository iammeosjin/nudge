import { Trigger } from '../types.ts';

const triggerCache = new Map<string, Promise<Trigger | null>>();

export default triggerCache;
