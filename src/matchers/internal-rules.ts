import { compilePatternSources } from "./compile.js";
import { LOOSE_SEPARATOR } from "./literals.js";
import { isOptionalSuffixAtom, isWordLikeAtom } from "./rule-classifier.js";
import { readRuleAtoms, type RuleAtom } from "./rule-reader.js";
import { splitTopLevelAlternatives } from "./rule-scanner.js";
import type { CompiledPattern } from "./compile.js";

const IN_TOKEN_SEPARATOR = String.raw`[^\p{L}\p{N}\s]*`;

export const compileStrictInternalRulePatterns = (
  sources: readonly string[],
): CompiledPattern[] => compilePatternSources(sources, true);

export const compileLooseInternalRulePatterns = (
  sources: readonly string[],
): CompiledPattern[] =>
  compilePatternSources(sources.map(loosenInternalRuleSource), false);

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
