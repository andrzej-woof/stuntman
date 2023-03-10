import { AppError, HttpCode, MAX_RULE_TTL_SECONDS, MIN_RULE_TTL_SECONDS, logger, RawHeaders, errorToLog } from '@stuntman/shared';
import type * as Stuntman from '@stuntman/shared';

export const validateSerializedRuleProperties = (rule: Stuntman.SerializedRule): void => {
    if (!rule) {
        throw new AppError({ httpCode: HttpCode.BAD_REQUEST, message: 'invalid serialized rule' });
    }
    // TODO make a nice regex to limit rule names
    if (typeof rule.id !== 'string' || !rule.id.trim()) {
        throw new AppError({ httpCode: HttpCode.BAD_REQUEST, message: 'invalid rule.id' });
    }
    if (
        typeof rule.matches !== 'object' ||
        !('remoteFn' in rule.matches) ||
        typeof rule.matches.remoteFn !== 'string' ||
        !rule.matches.remoteFn.trim()
    ) {
        throw new AppError({ httpCode: HttpCode.BAD_REQUEST, message: 'invalid rule.matches' });
    }
    if (typeof rule.priority !== 'undefined' && (typeof rule.priority !== 'number' || rule.priority < 0)) {
        throw new AppError({ httpCode: HttpCode.BAD_REQUEST, message: 'invalid rule.priority' });
    }
    if (typeof rule.actions !== 'object') {
        throw new AppError({ httpCode: HttpCode.BAD_REQUEST, message: 'invalid rule.actions - not an object' });
    }
    if (
        rule.actions.proxyPass !== true &&
        typeof rule.actions.mockResponse !== 'object' &&
        typeof rule.actions.modifyRequest !== 'object' &&
        typeof rule.actions.modifyResponse !== 'object'
    ) {
        throw new AppError({
            httpCode: HttpCode.BAD_REQUEST,
            message: 'invalid rule.actions - missing one of: proxyPass, mockResponse, modifyRequest, modifyResponse',
        });
    }
    if (typeof rule.actions.mockResponse !== 'undefined') {
        if (typeof rule.actions.mockResponse !== 'object' || Array.isArray(rule.actions.mockResponse)) {
            throw new AppError({ httpCode: HttpCode.BAD_REQUEST, message: 'invalid rule.actions.mockResponse' });
        }
        if (
            'remoteFn' in rule.actions.mockResponse &&
            ('rawHeaders' in rule.actions.mockResponse ||
                'status' in rule.actions.mockResponse ||
                'body' in rule.actions.mockResponse)
        ) {
            throw new AppError({ httpCode: HttpCode.BAD_REQUEST, message: 'invalid rule.actions.mockResponse' });
        }
        if (
            'remoteFn' in rule.actions.mockResponse &&
            (typeof rule.actions.mockResponse.remoteFn !== 'string' || !rule.actions.mockResponse.remoteFn.trim())
        ) {
            throw new AppError({ httpCode: HttpCode.BAD_REQUEST, message: 'invalid rule.actions.mockResponse' });
        }
        if (!('remoteFn' in rule.actions.mockResponse)) {
            if (typeof rule.actions.mockResponse.status !== 'number') {
                throw new AppError({
                    httpCode: HttpCode.BAD_REQUEST,
                    message: 'invalid rule.actions.mockResponse.status',
                });
            }
            if (
                typeof rule.actions.mockResponse.rawHeaders !== 'undefined' &&
                (typeof rule.actions.mockResponse.rawHeaders === 'string' ||
                    !Array.isArray(rule.actions.mockResponse.rawHeaders) ||
                    rule.actions.mockResponse.rawHeaders.length % 2 !== 0 ||
                    rule.actions.mockResponse.rawHeaders.some((header) => typeof header !== 'string'))
            ) {
                throw new AppError({
                    httpCode: HttpCode.BAD_REQUEST,
                    message: 'invalid rule.actions.mockResponse.rawHeaders',
                });
            }
            if (typeof rule.actions.mockResponse.body !== 'undefined' && typeof rule.actions.mockResponse.body !== 'string') {
                throw new AppError({ httpCode: HttpCode.BAD_REQUEST, message: 'invalid rule.actions.mockResponse.body' });
            }
        }
    }
    if (
        typeof rule.actions.modifyRequest !== 'undefined' &&
        (typeof rule.actions.modifyRequest.remoteFn !== 'string' || !rule.actions.modifyRequest.remoteFn.trim())
    ) {
        throw new AppError({ httpCode: HttpCode.BAD_REQUEST, message: 'invalid rule.actions.modifyRequest' });
    }
    if (
        typeof rule.actions.modifyResponse !== 'undefined' &&
        (typeof rule.actions.modifyResponse.remoteFn !== 'string' || !rule.actions.modifyResponse.remoteFn.trim())
    ) {
        throw new AppError({ httpCode: HttpCode.BAD_REQUEST, message: 'invalid rule.actions.modifyResponse' });
    }
    if (
        typeof rule.disableAfterUse !== 'undefined' &&
        typeof rule.disableAfterUse !== 'boolean' &&
        (typeof rule.disableAfterUse !== 'number' || rule.disableAfterUse < 0)
    ) {
        throw new AppError({ httpCode: HttpCode.BAD_REQUEST, message: 'invalid rule.disableAfterUse' });
    }
    if (
        typeof rule.removeAfterUse !== 'undefined' &&
        typeof rule.removeAfterUse !== 'boolean' &&
        (typeof rule.removeAfterUse !== 'number' || rule.removeAfterUse < 0)
    ) {
        throw new AppError({ httpCode: HttpCode.BAD_REQUEST, message: 'invalid rule.removeAfterUse' });
    }
    if (
        typeof rule.labels !== 'undefined' &&
        (typeof rule.labels !== 'object' || !Array.isArray(rule.labels) || rule.labels.some((label) => typeof label !== 'string'))
    ) {
        throw new AppError({ httpCode: HttpCode.BAD_REQUEST, message: 'invalid rule.labels' });
    }
    if (rule.actions.mockResponse && rule.actions.modifyResponse) {
        throw new AppError({
            httpCode: HttpCode.BAD_REQUEST,
            message: 'rule.actions.mockResponse and rule.actions.modifyResponse are mutually exclusive',
        });
    }
    if (
        !rule.ttlSeconds ||
        typeof rule.ttlSeconds !== 'number' ||
        rule.ttlSeconds < MIN_RULE_TTL_SECONDS ||
        rule.ttlSeconds > MAX_RULE_TTL_SECONDS
    ) {
        throw new AppError({
            httpCode: HttpCode.BAD_REQUEST,
            message: `rule.ttlSeconds should be within ${MIN_RULE_TTL_SECONDS} and ${MAX_RULE_TTL_SECONDS}`,
        });
    }
    if (typeof rule.isEnabled !== 'undefined' && typeof rule.isEnabled !== 'boolean') {
        throw new AppError({ httpCode: HttpCode.BAD_REQUEST, message: 'invalid rule.isEnabled' });
    }
    if (typeof rule.storeTraffic !== 'undefined' && typeof rule.storeTraffic !== 'boolean') {
        throw new AppError({ httpCode: HttpCode.BAD_REQUEST, message: 'invalid rule.storeTraffic' });
    }
};

export const validateDeserializedRule = (deserializedRule: Stuntman.Rule) => {
    // TODO validate other functions ?
    let matchValidationResult: Stuntman.RuleMatchResult;
    try {
        matchValidationResult = deserializedRule.matches({
            id: 'validation',
            method: 'GET',
            rawHeaders: new RawHeaders(),
            timestamp: Date.now(),
            url: 'http://dummy.invalid/',
        });
    } catch (error: any) {
        logger.error({ ruleId: deserializedRule.id, error: errorToLog(error) }, 'match function threw an error');
        throw new AppError({
            httpCode: HttpCode.UNPROCESSABLE_ENTITY,
            message: 'match function threw an error',
        });
    }
    if (
        matchValidationResult !== true &&
        matchValidationResult !== false &&
        matchValidationResult.result !== true &&
        matchValidationResult.result !== false
    ) {
        logger.error({ ruleId: deserializedRule.id, matchValidationResult }, 'match function retruned invalid value');
        throw new AppError({ httpCode: HttpCode.UNPROCESSABLE_ENTITY, message: 'match function returned invalid value' });
    }
};
