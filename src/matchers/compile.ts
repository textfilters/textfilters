export interface CompiledPattern {
  readonly re: RegExp;
  readonly trimHyphenTail?: boolean;
}

export interface CompilePatternOptions {
  readonly trimHyphenTail?: boolean;
}

const GLOBAL_UNICODE_FLAGS = "giu";
const ANCHORED_UNICODE_FLAGS = "iu";

export const compilePatternSources = (
  sources: readonly string[],
  wholeToken: boolean,
  options: CompilePatternOptions = {},
): CompiledPattern[] =>
  sources
    // Whole-token patterns are anchored here so range collectors do not need to
    // know whether a pattern came from strict token matching or global search.
    .map((source) => (wholeToken ? `^(?:${source})$` : source))
    .map((source) => compilePattern(source, wholeToken, options))
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
  source: string,
  wholeToken: boolean,
  options: CompilePatternOptions,
): CompiledPattern | null => {
  try {
    return {
      re: new RegExp(
        source,
        wholeToken ? ANCHORED_UNICODE_FLAGS : GLOBAL_UNICODE_FLAGS,
      ),
      trimHyphenTail: options.trimHyphenTail,
    };
  } catch {
    return null;
  }
};
