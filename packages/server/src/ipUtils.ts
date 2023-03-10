import { networkInterfaces } from 'os';
import dns, { Resolver as DNSResolver } from 'node:dns';
import { getDnsResolutionCache } from './storage';
import { errorToLog, logger } from '@stuntman/shared';

const localhostIPs: string[] = ['127.0.0.1', '::1'];
const IP_WITH_OPTIONAL_PORT_REGEX = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}(:[0-9]+)?$/i;

for (const nets of Object.values(networkInterfaces())) {
    if (!nets) {
        continue;
    }
    for (const net of nets) {
        const familyV4Value = typeof net.family === 'string' ? 'IPv4' : 4;
        if (net.family === familyV4Value && !localhostIPs.includes(net.address)) {
            localhostIPs.push(net.address);
        }
    }
}

export class IPUtils {
    protected dnsResolutionCache;
    protected mockUuid: string;
    externalDns: dns.Resolver | null = null;

    constructor(options: { mockUuid: string; externalDns?: string[] }) {
        this.mockUuid = options.mockUuid;
        if (options.externalDns?.length) {
            this.externalDns = new DNSResolver();
            this.externalDns.setServers(options.externalDns);
        }
        this.dnsResolutionCache = getDnsResolutionCache(this.mockUuid);
    }

    isLocalhostIP(ip: string): boolean {
        return localhostIPs.includes(ip);
    }

    private async resolveIPs(hostname: string, options?: { useExternalDns?: true }): Promise<string[]> {
        return new Promise<string[]>((resolve, reject) => {
            const callback = (error: NodeJS.ErrnoException | null, addresses: string | string[]) => {
                if (error) {
                    logger.debug({ error: errorToLog(error), hostname }, 'error resolving hostname');
                    reject(error);
                    return;
                }
                if (typeof addresses === 'string') {
                    logger.debug({ ip: [addresses], hostname }, 'resolved hostname');
                    resolve([addresses]);
                    return;
                }
                if (!addresses || addresses.length === 0) {
                    logger.debug({ hostname }, 'no addresses found');
                    resolve([]);
                    return;
                }
                logger.debug({ ip: addresses, hostname }, 'resolved hostname');
                resolve(addresses);
            };
            if (options?.useExternalDns) {
                if (!this.externalDns) {
                    reject(new Error('external dns servers not set'));
                    return;
                }
                this.externalDns.resolve(hostname, callback);
                return;
            }
            // TODO general handling of IPv6
            dns.resolve4(hostname, callback);
        });
    }

    async resolveIP(hostname: string, options?: { useExternalDns?: true }): Promise<string> {
        const cachedIP = this.dnsResolutionCache.get(hostname);
        if (cachedIP) {
            return cachedIP;
        }
        const resolved = await this.resolveIPs(hostname, options);
        if (!resolved || resolved.length < 1) {
            throw new Error('unable to resolve IP');
        }
        const ip = resolved[0]!;
        this.dnsResolutionCache.set(hostname, ip);
        return ip;
    }

    isIP(hostname: string): boolean {
        return IP_WITH_OPTIONAL_PORT_REGEX.test(hostname);
    }
}
