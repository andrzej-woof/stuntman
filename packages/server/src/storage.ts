import LRUCache from 'lru-cache';
import type * as Stuntman from '@stuntman/shared';
import sizeof from 'object-sizeof';
import defaults from 'defaults';
import { DEFAULT_CACHE_MAX_ENTRIES, DEFAULT_CACHE_MAX_SIZE, DEFAULT_CACHE_TTL } from '@stuntman/shared';

const TRAFFIC_STORE_OPTIONS: LRUCache.Options<string, Stuntman.LogEntry> = {
    max: DEFAULT_CACHE_MAX_ENTRIES,
    maxSize: DEFAULT_CACHE_MAX_SIZE,
    ttl: DEFAULT_CACHE_TTL,
    allowStale: false,
    updateAgeOnGet: false,
    updateAgeOnHas: false,
    sizeCalculation: (value) => sizeof(value),
};
const DNS_CACHE_OPTIONS: LRUCache.Options<string, string> = {
    max: 1000,
    ttl: 1000 * 60 * 15,
    allowStale: false,
    updateAgeOnGet: false,
    updateAgeOnHas: false,
};

const trafficStoreInstances: Record<string, LRUCache<string, Stuntman.LogEntry>> = {};
const dnsResolutionCacheInstances: Record<string, LRUCache<string, string>> = {};

export const getTrafficStore = (key: string, options?: LRUCache.Options<string, Stuntman.LogEntry>) => {
    if (!(key in trafficStoreInstances)) {
        trafficStoreInstances[key] = new LRUCache<string, Stuntman.LogEntry>(defaults(options, TRAFFIC_STORE_OPTIONS));
    }
    return trafficStoreInstances[key];
};

export const getDnsResolutionCache = (key: string, options?: LRUCache.Options<string, string>) => {
    if (!(key in dnsResolutionCacheInstances)) {
        dnsResolutionCacheInstances[key] = new LRUCache<string, string>(defaults(options, DNS_CACHE_OPTIONS));
    }
    return dnsResolutionCacheInstances[key];
};
