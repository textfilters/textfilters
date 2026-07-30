import type { ProfanityTaxonomyMetadata } from "../types.js";
import { ruleIdentityMetadata } from "./rule-metadata.js";
import { scanGuardsForSource, type PatternScanGuards } from "./scan-guards.js";

export { patternMayStartBefore, patternMayStartIn } from "./scan-guards.js";

export interface CompiledPattern
  extends ProfanityTaxonomyMetadata, PatternScanGuards {
  readonly re: RegExp;
  readonly trimHyphenTail?: boolean;
  readonly trimHyphenTailMin?: number;
  readonly ruleId?: string;
}

export interface CompilePatternOptions {
  readonly trimHyphenTail?: boolean;
  readonly trimHyphenTailMin?: number;
}

export interface CompilePatternSource extends ProfanityTaxonomyMetadata {
  readonly source: string;
  readonly ruleId?: string;
  readonly trimHyphenTail?: boolean;
  readonly trimHyphenTailMin?: number;
}

interface CompiledPatternSource extends CompilePatternSource {
  readonly scanSource: string;
}

const GLOBAL_UNICODE_FLAGS = "giu";
const ANCHORED_UNICODE_FLAGS = "iu";

export const compilePatternDefinitions = (
  definitions: readonly CompilePatternSource[],
  wholeToken: boolean,
  options: CompilePatternOptions = {},
): CompiledPattern[] =>
  definitions
    // Whole-token patterns are anchored here so range collectors do not need to
    // know whether a pattern came from strict token matching or global search.
    .map((definition) => ({
      source: wholeToken ? `^(?:${definition.source})$` : definition.source,
      scanSource: definition.source,
      trimHyphenTail: definition.trimHyphenTail ?? options.trimHyphenTail,
      trimHyphenTailMin:
        definition.trimHyphenTailMin ?? options.trimHyphenTailMin,
      ...ruleIdentityMetadata(definition),
    }))
    .map((definition) => compilePattern(definition, wholeToken))
    .filter((pattern): pattern is CompiledPattern => pattern !== null)
    .sort((left, right) => right.re.source.length - left.re.source.length);

export const patternMatches = (
  pattern: CompiledPattern,
  value: string,
): boolean => {
  pattern.re.lastIndex = 0;
  return pattern.re.test(value);
};

const compilePattern = (
  definition: CompiledPatternSource,
  wholeToken: boolean,
): CompiledPattern | null => {
  try {
    return {
      re: new RegExp(
        definition.source,
        wholeToken ? ANCHORED_UNICODE_FLAGS : GLOBAL_UNICODE_FLAGS,
      ),
      ...scanGuardsForSource(definition.scanSource, !wholeToken),
      trimHyphenTail: definition.trimHyphenTail,
      trimHyphenTailMin: definition.trimHyphenTailMin,
      ...ruleIdentityMetadata(definition),
    };
  } catch {
    return null;
  }
};
