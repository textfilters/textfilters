import type { ProfanityTaxonomyMetadata } from "../types.js";
import { ruleIdentityMetadata } from "./rule-metadata.js";

export interface CompiledPattern extends ProfanityTaxonomyMetadata {
  readonly re: RegExp;
  readonly trimHyphenTail?: boolean;
  readonly ruleId?: string;
}

export interface CompilePatternOptions {
  readonly trimHyphenTail?: boolean;
}

export interface CompilePatternSource extends ProfanityTaxonomyMetadata {
  readonly source: string;
  readonly ruleId?: string;
}

const GLOBAL_UNICODE_FLAGS = "giu";
const ANCHORED_UNICODE_FLAGS = "iu";

export const compilePatternSources = (
  sources: readonly string[],
  wholeToken: boolean,
  options: CompilePatternOptions = {},
): CompiledPattern[] =>
  compilePatternDefinitions(
    sources.map((source) => ({ source })),
    wholeToken,
    options,
  );

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
      ...ruleIdentityMetadata(definition),
    }))
    .map((definition) => compilePattern(definition, wholeToken, options))
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
  definition: CompilePatternSource,
  wholeToken: boolean,
  options: CompilePatternOptions,
): CompiledPattern | null => {
  try {
    return {
      re: new RegExp(
        definition.source,
        wholeToken ? ANCHORED_UNICODE_FLAGS : GLOBAL_UNICODE_FLAGS,
      ),
      trimHyphenTail: options.trimHyphenTail,
      ...ruleIdentityMetadata(definition),
    };
  } catch {
    return null;
  }
};
