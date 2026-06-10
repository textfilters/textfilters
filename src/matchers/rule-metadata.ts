import type { ProfanityTaxonomyMetadata } from "../types.js";

export interface RuleTaxonomyMetadata extends ProfanityTaxonomyMetadata {}

export interface RuleSourceMetadata extends RuleTaxonomyMetadata {
  readonly source: string;
}

export interface RuleIdentityMetadata extends RuleTaxonomyMetadata {
  readonly ruleId?: string;
}

export const ruleSourceMetadata = (
  rule: RuleSourceMetadata,
): RuleSourceMetadata => ({
  source: rule.source,
  ...ruleTaxonomyMetadata(rule),
});

export const ruleIdentityMetadata = (
  rule: RuleIdentityMetadata,
): RuleIdentityMetadata => ({
  ...(rule.ruleId === undefined ? {} : { ruleId: rule.ruleId }),
  ...ruleTaxonomyMetadata(rule),
});

const ruleTaxonomyMetadata = (
  rule: RuleTaxonomyMetadata,
): RuleTaxonomyMetadata => ({
  ...(rule.category === undefined ? {} : { category: rule.category }),
  ...(rule.severity === undefined ? {} : { severity: rule.severity }),
});
