import fs from 'fs';
import { globSync } from 'glob';
import tsImport from 'ts-import';
import { catchAllRule } from './catchAll';
import { echoRule } from './echo';
import { stuntmanConfig, logger, errorToLog } from '@stuntman/shared';
import type * as Stuntman from '@stuntman/shared';

export const DEFAULT_RULES: Stuntman.DeployedRule[] = [catchAllRule, echoRule];

export const loadRules = async (): Promise<Stuntman.DeployedRule[]> => {
    const customRules: Stuntman.DeployedRule[] = [];
    if (!stuntmanConfig.mock.rulesPath || !fs.existsSync(stuntmanConfig.mock.rulesPath)) {
        logger.debug({ rulesPath: stuntmanConfig.mock.rulesPath }, `additional rules directory not found`);
        return [];
    }
    logger.debug({ rulesPath: stuntmanConfig.mock.rulesPath }, `loading additional rules`);
    const filePaths = globSync('*.[tj]s', { absolute: true, cwd: stuntmanConfig.mock.rulesPath });
    const tsImportCompiledFileNames = filePaths.map((p) => p.replace(/\.[^/.]+$/u, '.js'));
    const tsImportDuplicatedCompiledFileNames = tsImportCompiledFileNames.filter(
        (currentValue, currentIndex) => tsImportCompiledFileNames.indexOf(currentValue) !== currentIndex
    );
    if (tsImportDuplicatedCompiledFileNames.length > 0) {
        logger.error(
            { tsImportDuplicatedCompiledFileNames },
            'duplicated compiled file names https://github.com/radarsu/ts-import/issues/32'
        );
        throw new Error('duplicated compiled file names https://github.com/radarsu/ts-import/issues/32');
    }
    for (const filePath of filePaths) {
        // TODO add .ts rule support
        try {
            const loadedFile = await tsImport.load(filePath, { useCache: false });
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const exportedRules = (Object.values(loadedFile) as Stuntman.DeployedRule[]).filter((rule) => {
                if (!rule || !rule.id || typeof rule.matches !== 'function') {
                    logger.error({ filePath, rule }, 'invalid exported rule');
                    return false;
                }
                return true;
            });
            customRules.push(...exportedRules);
        } catch (error) {
            logger.error({ filePath, error: errorToLog(error as Error) }, 'error importing rule');
        }
    }
    const ruleIds = [...DEFAULT_RULES, ...customRules].map((rule) => rule.id);
    const duplicatedRuleIds = ruleIds.filter((currentValue, currentIndex) => ruleIds.indexOf(currentValue) !== currentIndex);
    if (duplicatedRuleIds.length > 0) {
        logger.error({ duplicatedRuleIds }, 'duplicated rule ids');
        throw new Error('duplicated rule ids');
    }
    return customRules;
};
