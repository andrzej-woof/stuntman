import type * as Stuntman from '@stuntman/shared';
import { loadRules } from './loadRules';
export { DEFAULT_RULES } from './loadRules';

export const CUSTOM_RULES: Stuntman.DeployedRule[] = await loadRules();
