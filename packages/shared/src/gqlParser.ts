import type * as Stuntman from './index';
import { logger } from './logger';

export const naiveGQLParser = (body: Buffer | string): Stuntman.GQLRequestBody | undefined => {
    // TODO consider real parser :P
    try {
        let json: Stuntman.GQLRequestBody | undefined = undefined;
        try {
            json = JSON.parse(Buffer.isBuffer(body) ? body.toString('utf-8') : body);
        } catch {
            // ignore
        }
        if (!json?.query && !json?.operationName) {
            return undefined;
        }
        const trimmed = json.query.trim();
        if (!/^(query|mutation)\s+/.test(trimmed) || !/[{}]/.test(trimmed)) {
            throw new Error('invalid query');
        }
        const lines = trimmed
            .replace(/{/g, '{\n')
            .split('\n')
            .map((l) => l.replace(/^\s+/g, '').trim())
            .filter((l) => !!l);
        if (/^query /.test(lines[0]!)) {
            json.type = 'query';
        } else if (/^mutation /.test(lines[0]!)) {
            json.type = 'mutation';
        }
        if (json.operationName && lines[1]) {
            json.methodName = lines[1].split('(')[0]!.split('{')[0]!;
        }
        return json;
    } catch (error) {
        logger.debug(error, 'unable to parse GQL');
    }
    return undefined;
};
