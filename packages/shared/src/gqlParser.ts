import type * as Stuntman from './index';
import { logger } from './logger';

export const naiveGQLParser = (body: Buffer | string): Stuntman.GQLRequestBody | undefined => {
    // TODO consider real parser :P
    try {
        let json: Stuntman.GQLRequestBody | undefined = undefined;
        try {
            json = JSON.parse(Buffer.isBuffer(body) ? body.toString('utf-8') : body);
        } catch (kiss) {
            // and swallow
        }
        if (!json?.query && !json?.operationName) {
            return undefined;
        }
        const lines = json.query
            .split('\n')
            .map((l) => l.replace(/^\s+/g, '').trim())
            .filter((l) => !!l);
        if (!lines[0]) {
            throw new Error('unable to find query');
        }
        if (/^query /.test(lines[0])) {
            json.type = 'query';
        } else if (/^mutation /.test(lines[0])) {
            json.type = 'mutation';
        } else {
            throw new Error(`Unable to resolve query type of ${lines[0]}`);
        }
        if (json.operationName && lines[1]) {
            json.methodName = lines[1].split('(')[0]!.split('{')[0]!;
        } else if (json.operationName) {
            json.methodName = lines[0].split('(')[0]!.split('{')[0]!;
        }
        return json;
    } catch (error) {
        logger.debug(error, 'unable to parse GQL');
    }
    return undefined;
};
