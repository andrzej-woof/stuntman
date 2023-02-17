import AwaitLock from 'await-lock';
import { AppError, DEFAULT_RULE_PRIORITY, HttpCode, logger } from '@stuntman/shared';
import type * as Stuntman from '@stuntman/shared';
import { DEFAULT_RULES } from './rules';

const rulesLock = new AwaitLock();

const transformMockRuleToLive = (rule: Stuntman.Rule): Stuntman.LiveRule => {
    return {
        ...rule,
        counter: 0,
        isEnabled: rule.isEnabled ?? true,
        createdTimestamp: Date.now(),
    };
};

class RuleExecutor {
    // TODO persistent rule storage maybe
    private _rules: Stuntman.LiveRule[];

    private get enabledRules() {
        if (!this._rules) {
            return new Array<Stuntman.LiveRule>();
        }
        const now = Date.now();
        return this._rules
            .filter((r) => (r.isEnabled && !Number.isFinite(r.ttlSeconds)) || r.createdTimestamp + r.ttlSeconds * 1000 > now)
            .sort((a, b) => (a.priority ?? DEFAULT_RULE_PRIORITY) - (b.priority ?? DEFAULT_RULE_PRIORITY));
    }

    constructor(rules?: Stuntman.Rule[]) {
        this._rules = (rules || []).map(transformMockRuleToLive);
    }

    private hasExpired() {
        const now = Date.now();
        return this._rules.some((r) => Number.isFinite(r.ttlSeconds) && r.createdTimestamp + r.ttlSeconds * 1000 < now);
    }

    private async cleanUpExpired() {
        if (!this.hasExpired()) {
            return;
        }
        await rulesLock.acquireAsync();
        const now = Date.now();
        try {
            this._rules = this._rules.filter((r) => {
                const shouldKeep = !Number.isFinite(r.ttlSeconds) || r.createdTimestamp + r.ttlSeconds * 1000 > now;
                if (!shouldKeep) {
                    logger.debug({ ruleId: r.id }, 'removing expired rule');
                }
                return shouldKeep;
            });
        } finally {
            await rulesLock.release();
        }
    }

    async addRule(rule: Stuntman.Rule, overwrite?: boolean): Promise<Stuntman.LiveRule> {
        await this.cleanUpExpired();
        await rulesLock.acquireAsync();
        try {
            if (this._rules.some((r) => r.id === rule.id)) {
                if (!overwrite) {
                    throw new AppError({ httpCode: HttpCode.CONFLICT, message: 'rule with given ID already exists' });
                }
                this._removeRule(rule.id);
            }
            const liveRule = transformMockRuleToLive(rule);
            this._rules.push(liveRule);
            logger.debug(liveRule, 'rule added');
            return liveRule;
        } finally {
            await rulesLock.release();
        }
    }

    private _removeRule(ruleOrId: string | Stuntman.Rule) {
        this._rules = this._rules.filter((r) => {
            const notFound = r.id !== (typeof ruleOrId === 'string' ? ruleOrId : ruleOrId.id);
            if (!notFound) {
                logger.debug({ ruleId: r.id }, 'rule removed');
            }
            return notFound;
        });
    }

    async removeRule(id: string): Promise<void>;
    async removeRule(rule: Stuntman.Rule): Promise<void>;
    async removeRule(ruleOrId: string | Stuntman.Rule): Promise<void> {
        await this.cleanUpExpired();
        await rulesLock.acquireAsync();
        try {
            this._removeRule(ruleOrId);
        } finally {
            await rulesLock.release();
        }
    }

    enableRule(id: string): void;
    enableRule(rule: Stuntman.Rule): void;
    enableRule(ruleOrId: string | Stuntman.Rule): void {
        this._rules.forEach((r) => {
            if (r.id === (typeof ruleOrId === 'string' ? ruleOrId : ruleOrId.id)) {
                r.isEnabled = true;
                logger.debug({ ruleId: r.id }, 'rule enabled');
            }
        });
    }

    disableRule(id: string): void;
    disableRule(rule: Stuntman.Rule): void;
    disableRule(ruleOrId: string | Stuntman.Rule): void {
        this._rules.forEach((r) => {
            if (r.id === (typeof ruleOrId === 'string' ? ruleOrId : ruleOrId.id)) {
                r.isEnabled = false;
                logger.debug({ ruleId: r.id }, 'rule disabled');
            }
        });
    }

    async findMatchingRule(request: Stuntman.Request): Promise<Stuntman.LiveRule | null> {
        const logContext: Record<string, any> = {
            requestId: request.id,
        };
        const matchingRule = this.enabledRules.find((rule) => {
            const matchResult = rule.matches(request);
            if (typeof matchResult === 'boolean') {
                return matchResult;
            }
            return matchResult.result;
        });
        if (!matchingRule) {
            logger.debug(logContext, 'no matching rule found');
            return null;
        }
        const matchResult: Stuntman.RuleMatchResult = matchingRule.matches(request);
        logContext.ruleId = matchingRule.id;
        logger.debug(logContext, 'matching rule found');
        const matchingRuleClone = Object.freeze(Object.assign({}, matchingRule));
        ++matchingRule.counter;
        logContext.ruleCounter = matchingRule.counter;
        if (Number.isNaN(matchingRule.counter) || !Number.isFinite(matchingRule.counter)) {
            matchingRule.counter = 0;
            logger.warn(logContext, "it's over 9000!!!");
        }
        if (matchingRule.disableAfterUse) {
            if (typeof matchingRule.disableAfterUse === 'boolean' || matchingRule.disableAfterUse <= matchingRule.counter) {
                logger.debug(logContext, 'disabling rule for future requests');
                this.disableRule(matchingRule);
            }
        }
        if (matchingRule.removeAfterUse) {
            if (typeof matchingRule.removeAfterUse === 'boolean' || matchingRule.removeAfterUse <= matchingRule.counter) {
                logger.debug(logContext, 'removing rule for future requests');
                this.removeRule(matchingRule);
            }
        }
        if (typeof matchResult !== 'boolean') {
            if (matchResult.disableRuleIds && matchResult.disableRuleIds.length > 0) {
                logger.debug(
                    { ...logContext, disableRuleIds: matchResult.disableRuleIds },
                    'disabling rules based on matchResult'
                );
                for (const ruleId of matchResult.disableRuleIds) {
                    this.disableRule(ruleId);
                }
            }
            if (matchResult.enableRuleIds && matchResult.enableRuleIds.length > 0) {
                logger.debug(
                    { ...logContext, disableRuleIds: matchResult.disableRuleIds },
                    'enabling rules based on matchResult'
                );
                for (const ruleId of matchResult.enableRuleIds) {
                    this.enableRule(ruleId);
                }
            }
        }
        return matchingRuleClone;
    }

    async getRules(): Promise<readonly Stuntman.LiveRule[]> {
        await this.cleanUpExpired();
        return this._rules;
    }

    async getRule(id: string): Promise<Stuntman.LiveRule | undefined> {
        await this.cleanUpExpired();
        return this._rules.find((r) => r.id === id);
    }
}

export const ruleExecutor = new RuleExecutor(DEFAULT_RULES.map((r) => ({ ...r, ttlSeconds: Infinity })));
