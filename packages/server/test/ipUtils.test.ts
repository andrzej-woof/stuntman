import { test, expect } from '@jest/globals';
import { IPUtils } from '../src/ipUtils';
import { v4 as uuidv4 } from 'uuid';

test('isLocalhostIP', async () => {
    const ipUtils = new IPUtils({
        mockUuid: uuidv4(),
    });
    expect(ipUtils.isLocalhostIP('127.0.0.1')).toEqual(true);
    expect(ipUtils.isLocalhostIP('::1')).toEqual(true);
});

test('resolveIPs', async () => {
    const ipUtils = new IPUtils({
        mockUuid: uuidv4(),
    });
    expect(await ipUtils.resolveIP('www.example.com')).toEqual('93.184.216.34');
    expect(ipUtils.isLocalhostIP(await ipUtils.resolveIP('localhost'))).toEqual(true);
    await expect(async () => await ipUtils.resolveIP('somehost.invalid')).rejects.toThrow();
});

test('resolveIPs - useExternalDns', async () => {
    const ipUtils = new IPUtils({
        mockUuid: uuidv4(),
        externalDns: ['8.8.8.8'],
    });
    expect(await ipUtils.resolveIP('www.example.com', { useExternalDns: true })).toEqual('93.184.216.34');
    expect(await ipUtils.resolveIP('www.example.com', { useExternalDns: true })).toEqual('93.184.216.34');
    await expect(async () => await ipUtils.resolveIP('localhost', { useExternalDns: true })).rejects.toThrow();
    await expect(async () => await ipUtils.resolveIP('somehost.invalid', { useExternalDns: true })).rejects.toThrow();
});

test('resolveIPs - external dns not set', async () => {
    const ipUtils = new IPUtils({
        mockUuid: uuidv4(),
        externalDns: [],
    });
    await expect(async () => await ipUtils.resolveIP('www.example.com', { useExternalDns: true })).rejects.toThrow();
});

test('isIP', async () => {
    const ipUtils = new IPUtils({
        mockUuid: uuidv4(),
        externalDns: [],
    });
    await expect(ipUtils.isIP('127.0.0.1')).toEqual(true);
    await expect(ipUtils.isIP('1.1.1.1')).toEqual(true);
    await expect(ipUtils.isIP('1.1.1.1234')).toEqual(false);
    await expect(ipUtils.isIP('string')).toEqual(false);
});
