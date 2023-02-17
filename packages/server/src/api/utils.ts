import serializeJavascript from 'serialize-javascript';
import type * as Stuntman from '@stuntman/shared';
import { logger } from '@stuntman/shared';
import { validateSerializedRuleProperties } from './validatiors';
import fs from 'fs';

// TODO
export const INDEX_DTS = fs.readFileSync(`${__dirname}/../../types${/\.js$/.test(__filename) ? '.d' : ''}.ts`, 'utf-8');

export const deserializeRule = (serializedRule: Stuntman.SerializedRule): Stuntman.Rule => {
    logger.debug(serializedRule, 'attempt to deserialize rule');
    validateSerializedRuleProperties(serializedRule);
    const rule: Stuntman.Rule = {
        id: serializedRule.id,
        matches: (req: Stuntman.Request) => new Function('____arg0', serializedRule.matches.remoteFn)(req),
        ttlSeconds: serializedRule.ttlSeconds,
        ...(serializedRule.disableAfterUse !== undefined && { disableAfterUse: serializedRule.disableAfterUse }),
        ...(serializedRule.removeAfterUse !== undefined && { removeAfterUse: serializedRule.removeAfterUse }),
        ...(serializedRule.labels !== undefined && { labels: serializedRule.labels }),
        ...(serializedRule.priority !== undefined && { priority: serializedRule.priority }),
        ...(serializedRule.isEnabled !== undefined && { isEnabled: serializedRule.isEnabled }),
        ...(serializedRule.storeTraffic !== undefined && { storeTraffic: serializedRule.storeTraffic }),
    };
    if (serializedRule.actions) {
        // TODO store the original localFn and variables sent from client for web UI editing maybe
        if (serializedRule.actions.mockResponse) {
            rule.actions = {
                mockResponse:
                    'remoteFn' in serializedRule.actions.mockResponse
                        ? (req: Stuntman.Request) =>
                              new Function(
                                  '____arg0',
                                  (serializedRule.actions?.mockResponse as Stuntman.SerializedRemotableFunction).remoteFn
                              )(req)
                        : serializedRule.actions.mockResponse,
            };
        } else {
            rule.actions = {};
            if (serializedRule.actions.modifyRequest) {
                rule.actions.modifyRequest = (req: Stuntman.Request) =>
                    new Function(
                        '____arg0',
                        (serializedRule.actions?.modifyRequest as Stuntman.SerializedRemotableFunction).remoteFn
                    )(req);
            }
            if (serializedRule.actions.modifyResponse) {
                rule.actions.modifyResponse = (req: Stuntman.Request, res: Stuntman.Response) =>
                    new Function(
                        '____arg0',
                        '____arg1',
                        (serializedRule.actions?.modifyResponse as Stuntman.SerializedRemotableFunction).remoteFn
                    )(req, res);
            }
        }
    }
    logger.debug(rule, 'deserialized rule');
    return rule;
};

export const escapedSerialize = (obj: any) =>
    serializeJavascript(obj).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, "\\n'\n+ '");

export const liveRuleToRule = (liveRule: Stuntman.LiveRule) => {
    const ruleClone: Stuntman.Rule = { ...liveRule };
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    delete ruleClone.counter;
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    delete ruleClone.createdTimestamp;
    return ruleClone;
};
