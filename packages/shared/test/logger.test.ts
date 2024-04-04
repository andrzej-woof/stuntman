import { test, expect } from '@jest/globals';
import { logger } from '../src/logger';

test('logger', async () => {
    expect(logger).toHaveProperty('trace');
    expect(logger).toHaveProperty('debug');
    expect(logger).toHaveProperty('info');
    expect(logger).toHaveProperty('warn');
    expect(logger).toHaveProperty('error');
    expect(typeof logger.trace).toEqual('function');
    expect(typeof logger.debug).toEqual('function');
    expect(typeof logger.info).toEqual('function');
    expect(typeof logger.warn).toEqual('function');
    expect(typeof logger.error).toEqual('function');
});
