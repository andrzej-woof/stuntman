import fs from 'fs';
import glob from 'glob';
import * as tsImport from 'ts-import';
import { catchAllRule } from './catchAll';
import { echoRule } from './echo';
import { stuntmanConfig, logger } from '@stuntman/shared';
import type * as Stuntman from '@stuntman/shared';

export const DEFAULT_RULES: Stuntman.DeployedRule[] = [catchAllRule, echoRule];
export const CUSTOM_RULES: Stuntman.DeployedRule[] = [];

const loadAdditionalRules = () => {
    if (!stuntmanConfig.mock.rulesPath || !fs.existsSync(stuntmanConfig.mock.rulesPath)) {
        logger.debug({ rulesPath: stuntmanConfig.mock.rulesPath }, `additional rules directory not found`);
        return;
    }
    logger.debug({ rulesPath: stuntmanConfig.mock.rulesPath }, `loading additional rules`);
    const filePaths = glob.sync('*.[tj]s', { absolute: true, cwd: stuntmanConfig.mock.rulesPath });
    for (const filePath of filePaths) {
        // TODO add .ts rule support
        try {
            const loadedFile = /\.js$/.test(filePath) ? require(filePath) : tsImport.loadSync(filePath);
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const exportedRules = (Object.values(loadedFile) as Stuntman.DeployedRule[]).filter((rule) => {
                if (!rule || !rule.id || typeof rule.matches !== 'function') {
                    logger.error({ filePath, rule }, 'invalid exported rule');
                    return false;
                }
                return true;
            });
            CUSTOM_RULES.push(...exportedRules);
        } catch (error) {
            logger.error({ filePath, error }, 'error importing rule');
        }
    }
    const ruleIds = [...DEFAULT_RULES, ...CUSTOM_RULES].map((rule) => rule.id);
    const duplicatedRuleIds = ruleIds.filter((currentValue, currentIndex) => ruleIds.indexOf(currentValue) !== currentIndex);
    if (duplicatedRuleIds.length > 0) {
        logger.error({ duplicatedRuleIds }, 'duplicated rule ids');
        throw new Error('duplicated rule ids');
    }
};

loadAdditionalRules();
