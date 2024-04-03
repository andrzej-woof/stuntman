import * as glob from 'glob';
import fs from 'fs';
import { test, expect, jest, describe } from '@jest/globals';
import { loadRules } from '../src/rules/loadRules';
import { stuntmanConfig } from '@stuntman/shared';

const mockedRules = glob.globSync('*.[tj]s', { absolute: true, cwd: `${__dirname}/__rules` });

describe('loadRules', () => {
    test('empty', async () => {
        expect(loadRules()).toEqual([]);
    });

    test('custom', async () => {
        const fsExistsSyncSpy = jest.spyOn(fs, 'existsSync').mockImplementation((path) => {
            return path === stuntmanConfig.mock.rulesPath;
        });
        const globSyncSpy = jest.spyOn(glob, 'globSync').mockImplementation(() => {
            return mockedRules.filter((p) => !/duplicate/.test(p) && !/tsImportBug/.test(p));
        });

        const loadedRules = loadRules();
        expect(loadedRules).toHaveLength(6);
        expect(loadedRules).toEqual(
            expect.arrayContaining(
                ['rule-ts', 'rule-js', 'rule2b-ts', 'rule2a-ts', 'rule2a-js', 'rule2b-js'].map((id) =>
                    expect.objectContaining({ id })
                )
            )
        );
        expect(fsExistsSyncSpy).toHaveBeenCalledWith(stuntmanConfig.mock.rulesPath);
        expect(globSyncSpy).toHaveBeenCalledWith('*.[tj]s', { absolute: true, cwd: stuntmanConfig.mock.rulesPath });

        fsExistsSyncSpy.mockRestore();
        globSyncSpy.mockRestore();
    });

    test('duplicated rule id', async () => {
        const fsExistsSyncSpy = jest.spyOn(fs, 'existsSync').mockImplementation((path) => {
            return path === stuntmanConfig.mock.rulesPath;
        });
        const globSyncSpy = jest.spyOn(glob, 'globSync').mockImplementation(() => {
            return mockedRules.filter((p) => /duplicate/.test(p));
        });

        expect(() => loadRules()).toThrow();

        fsExistsSyncSpy.mockRestore();
        globSyncSpy.mockRestore();
    });

    test('duplicated compiled file names', async () => {
        const fsExistsSyncSpy = jest.spyOn(fs, 'existsSync').mockImplementation((path) => {
            return path === stuntmanConfig.mock.rulesPath;
        });
        const globSyncSpy = jest.spyOn(glob, 'globSync').mockImplementation(() => {
            return mockedRules.filter((p) => /tsImportBug/.test(p));
        });

        expect(() => loadRules()).toThrow();

        fsExistsSyncSpy.mockRestore();
        globSyncSpy.mockRestore();
    });
});
