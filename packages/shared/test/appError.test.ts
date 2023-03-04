import { expect, test, jest } from '@jest/globals';
import { AppError } from '../src/appError';
import { HttpCode } from '../src/index';

jest.mock('fs', () => ({
    readFileSync: jest.fn(() => {
        return '{}';
    }),
}));

test('app error', async () => {
    const appError = new AppError({ httpCode: HttpCode.CONFLICT, message: 'my error' });
    expect(appError.stack).toMatch(/^\s*Error: my error\n\s*at.+appError\.ts.*/gm);
    expect(appError.httpCode).toEqual(HttpCode.CONFLICT);
    expect(appError.name).toEqual('Error');
    expect(appError.message).toEqual('my error');
    expect(appError.isOperational).toEqual(true);
    expect(`${appError}`).toEqual('Error: my error');
    expect(appError).toBeInstanceOf(Error);
});

test('isOperational', async () => {
    const appError = new AppError({ httpCode: HttpCode.CONFLICT, message: 'my error', isOperational: false });
    expect(appError.stack).toMatch(/^\s*Error: my error\n\s*at.+appError\.ts.*/gm);
    expect(appError.httpCode).toEqual(HttpCode.CONFLICT);
    expect(appError.name).toEqual('Error');
    expect(appError.message).toEqual('my error');
    expect(appError.isOperational).toEqual(false);
    expect(`${appError}`).toEqual('Error: my error');
    expect(appError).toBeInstanceOf(Error);
});

