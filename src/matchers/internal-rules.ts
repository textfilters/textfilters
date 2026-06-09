import { compilePatternSources } from "./compile.js";
import { LOOSE_SEPARATOR } from "./literals.js";
import { isOptionalSuffixAtom, isWordLikeAtom } from "./rule-classifier.js";
import { readRuleAtoms, type RuleAtom } from "./rule-reader.js";
import { splitTopLevelAlternatives } from "./rule-scanner.js";
import type { CompiledPattern } from "./compile.js";

const IN_TOKEN_SEPARATOR = String.raw`[^\p{L}\p{N}\s]*`;

export interface InternalProfanityRule {
  readonly id: string;
  readonly source: string;
}

export const createBuiltInProfanityRules = (
  sources: readonly string[],
  corpus: "strict" | "loose",
): InternalProfanityRule[] =>
  sources.map((source, index) => ({
    id: `builtin:${corpus}:${index}:${stableRuleSourceHash(source)}`,
    source,
  }));

export const compileStrictInternalRulePatterns = (
  rules: readonly InternalProfanityRule[],
): CompiledPattern[] =>
  compilePatternSources(
    rules.map((rule) => rule.source),
    true,
  );

export const compileLooseInternalRulePatterns = (
  rules: readonly InternalProfanityRule[],
): CompiledPattern[] =>
  compilePatternSources(
    rules.map((rule) => loosenInternalRuleSource(rule.source)),
    false,
    {
      trimHyphenTail: true,
    },
  );

const stableRuleSourceHash = (source: string): string => {
  let hash = 0x811c9dc5;

  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return (hash >>> 0).toString(36).padStart(7, "0");
};

const loosenInternalRuleSource = (source: string): string => {
  if (source === "бля[дт](?:[а-яё]+)?") {
    return `б${LOOSE_SEPARATOR}л${LOOSE_SEPARATOR}я${IN_TOKEN_SEPARATOR}[дт](?:${IN_TOKEN_SEPARATOR}[а-яё])*`;
  }

  let previousWasWordLike = false;
  let result = "";

  for (const atom of readRuleAtoms(source)) {
    const wordLike = isWordLikeAtom(atom);

    // Optional suffixes should allow punctuation inside the same obfuscated word
    // but must not cross whitespace into the next word.
    if (previousWasWordLike && wordLike) {
      result += isOptionalSuffixAtom(atom)
        ? IN_TOKEN_SEPARATOR
        : LOOSE_SEPARATOR;
    }

    result += loosenRuleAtom(atom);
    previousWasWordLike = wordLike;
  }

  return result;
};

const loosenRuleAtom = (atom: RuleAtom): string => {
  if (isOptionalSuffixAtom(atom)) {
    return loosenOptionalSuffix(atom);
  }

  if (isRepeatedSingleAtom(atom)) {
    return `${atom.base}(?:${LOOSE_SEPARATOR}${atom.base})*`;
  }

  if (isPlainGroup(atom.base)) {
    return loosenGroup(atom);
  }

  return atom.source;
};

const loosenOptionalSuffix = (atom: RuleAtom): string => {
  const classSource = atom.base.match(/^\(\?:(\[[^\]]+\])\+\)$/u)?.[1];
  // Turn `(?:[а-яё]+)?` into an optional sequence that can consume split suffix
  // letters, for example `за-е-б-а-л`, while staying within the current token.
  return classSource === undefined
    ? loosenGroup(atom)
    : `(?:${classSource}(?:${IN_TOKEN_SEPARATOR}${classSource})*)?`;
};

const loosenGroup = (atom: RuleAtom): string => {
  const prefix = atom.base.startsWith("(?:") ? "(?:" : "(";
  const bodyStart = atom.base.startsWith("(?:") ? 3 : 1;
  const body = atom.base.slice(bodyStart, -1);
  const quantifier = atom.source.slice(atom.base.length);
  // Groups with alternatives such as `(у|ал|нуть)` need the same loose expansion
  // inside each alternative; treating the group as one atom misses `е-б-н-у-т-ь`.
  const alternatives = splitTopLevelAlternatives(body).map(
    loosenInternalRuleSource,
  );

  return `${prefix}${alternatives.join("|")})${quantifier}`;
};

const isPlainGroup = (source: string): boolean =>
  source.startsWith("(") && !/^\(\?<?[=!]/u.test(source);

const isRepeatedSingleAtom = (atom: RuleAtom): boolean =>
  atom.source === `${atom.base}+` && Array.from(atom.base).length === 1;
