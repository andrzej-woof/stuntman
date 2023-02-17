import { catchAllRule } from './catchAll';
import { echoRule } from './echo';
import type * as Stuntman from '@stuntman/shared';

// TODO add option to load rules additional default rules from some nice configurable folder

export const DEFAULT_RULES: Stuntman.DeployedRule[] = [catchAllRule, echoRule];
