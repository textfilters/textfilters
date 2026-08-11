import { buildLoosePatterns } from "../../matchers/build.js";
import {
  buildLooseCandidateIndex,
  looseCandidateIndexDiagnostics,
  type LooseGlobalScanFallbackReason,
} from "../../matchers/loose-candidates.js";
import { createBuiltInProfanityRules } from "../../matchers/internal-rules.js";
import { dictionaryRulesForMode } from "../profanity.js";
import { RUSSIAN_PROFANITY_DICTIONARY } from "./index.js";

export interface RussianGlobalScanFallback {
  readonly ruleId: string;
  readonly reason: LooseGlobalScanFallbackReason;
}

export interface RussianMatcherCostReport {
  readonly strictRuleCount: number;
  readonly looseRuleCount: number;
  readonly stretchingRuleCount: number;
  readonly candidateIndexedLooseRuleCount: number;
  readonly globalScanFallbackLooseRuleCount: number;
  readonly globalScanFallbacks: readonly RussianGlobalScanFallback[];
}

export const russianMatcherCostReport = (): RussianMatcherCostReport => {
  const strictRules = dictionaryRulesForMode(
    RUSSIAN_PROFANITY_DICTIONARY,
    "strict",
  );
  const looseRules = dictionaryRulesForMode(
    RUSSIAN_PROFANITY_DICTIONARY,
    "loose",
  );
  const loosePatterns = buildLoosePatterns({
    internal: createBuiltInProfanityRules(looseRules, "loose"),
    literals: [],
  });

  if (loosePatterns.length !== looseRules.length) {
    throw new Error(
      "Russian matcher cost report requires one compiled pattern per loose rule.",
    );
  }

  const diagnostics = looseCandidateIndexDiagnostics(
    buildLooseCandidateIndex(loosePatterns),
  );
  const globalScanFallbacks = diagnostics
    .filter((diagnostic) => diagnostic.strategy === "global-scan-fallback")
    .map((diagnostic) => {
      if (diagnostic.ruleId === undefined) {
        throw new Error(
          "Russian matcher cost report requires every loose pattern to have a rule id.",
        );
      }

      return {
        ruleId: diagnostic.ruleId,
        reason: diagnostic.reason,
      };
    })
    .sort((left, right) =>
      left.ruleId < right.ruleId ? -1 : left.ruleId > right.ruleId ? 1 : 0,
    );

  return {
    strictRuleCount: strictRules.length,
    looseRuleCount: looseRules.length,
    stretchingRuleCount: RUSSIAN_PROFANITY_DICTIONARY.rules.filter(
      (rule) => rule.match.loose?.stretch === true,
    ).length,
    candidateIndexedLooseRuleCount:
      diagnostics.length - globalScanFallbacks.length,
    globalScanFallbackLooseRuleCount: globalScanFallbacks.length,
    globalScanFallbacks,
  };
};
