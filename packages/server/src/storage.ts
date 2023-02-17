import LRUCache from 'lru-cache';
import type * as Stuntman from '@stuntman/shared';
import sizeof from 'object-sizeof';

const DNS_CACHE_OPTIONS: LRUCache.Options<string, string> = {
    max: 1000,
    ttl: 1000 * 60 * 15,
    allowStale: false,
    updateAgeOnGet: false,
    updateAgeOnHas: false,
};

const trafficStoreInstances: Record<string, LRUCache<string, Stuntman.LogEntry>> = {};
const dnsResolutionCacheInstances: Record<string, LRUCache<string, string>> = {};

export const getTrafficStore = (key: string, options?: Stuntman.StorageConfig) => {
    if (!(key in trafficStoreInstances)) {
        if (!options) {
            throw new Error('initialize with options first');
        }
        trafficStoreInstances[key] = new LRUCache<string, Stuntman.LogEntry>({
            max: options.limitCount,
            maxSize: options.limitSize,
            ttl: options.ttl,
            allowStale: false,
            updateAgeOnGet: false,
            updateAgeOnHas: false,
            sizeCalculation: (value) => sizeof(value),
        });
    }
    return trafficStoreInstances[key];
};

export const getDnsResolutionCache = (key: string) => {
    if (!(key in dnsResolutionCacheInstances)) {
        dnsResolutionCacheInstances[key] = new LRUCache<string, string>(DNS_CACHE_OPTIONS);
    }
    return dnsResolutionCacheInstances[key];
};
