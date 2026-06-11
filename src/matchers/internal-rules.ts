import { compilePatternDefinitions } from "./compile.js";
import { LOOSE_SEPARATOR } from "./literals.js";
import { isOptionalSuffixAtom, isWordLikeAtom } from "./rule-classifier.js";
import { readRuleAtoms, type RuleAtom } from "./rule-reader.js";
import { ruleIdentityMetadata, ruleSourceMetadata } from "./rule-metadata.js";
import { splitTopLevelAlternatives } from "./rule-scanner.js";
import type { ProfanityTaxonomyMetadata } from "../types.js";
import type { CompiledPattern } from "./compile.js";

const IN_TOKEN_SEPARATOR = String.raw`[^\p{L}\p{N}\s]*`;

export interface InternalProfanityRule extends ProfanityTaxonomyMetadata {
  readonly id: string;
  readonly source: string;
  readonly loose?: InternalProfanityRuleLooseOptions;
}

export type InternalProfanityRuleDefinition =
  | string
  | (ProfanityTaxonomyMetadata & {
      readonly id?: string;
      readonly source: string;
      readonly loose?: InternalProfanityRuleLooseOptions;
    });

export interface InternalProfanityRuleLooseOptions {
  readonly stretch?: boolean;
}

export const createBuiltInProfanityRules = (
  definitions: readonly InternalProfanityRuleDefinition[],
  corpus: "strict" | "loose",
): InternalProfanityRule[] =>
  definitions.map((definition, index) => {
    const rule = builtInRuleDefinitionToRule(definition);

    return {
      id:
        rule.id ??
        `builtin:${corpus}:${index}:${stableRuleSourceHash(rule.source)}`,
      ...rule,
    };
  });

export const compileStrictInternalRulePatterns = (
  rules: readonly InternalProfanityRule[],
): CompiledPattern[] =>
  compilePatternDefinitions(
    rules.map((rule) => ({
      source: rule.source,
      ruleId: rule.id,
      ...ruleIdentityMetadata(rule),
    })),
    true,
  );

export const compileLooseInternalRulePatterns = (
  rules: readonly InternalProfanityRule[],
): CompiledPattern[] =>
  compilePatternDefinitions(
    rules.map((rule) => ({
      source: loosenInternalRuleSource(rule.source, rule.loose),
      ruleId: rule.id,
      ...ruleIdentityMetadata(rule),
    })),
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

const builtInRuleDefinitionToRule = (
  definition: InternalProfanityRuleDefinition,
): Omit<InternalProfanityRule, "id"> & { readonly id?: string } =>
  typeof definition === "string"
    ? { source: definition }
    : {
        ...(definition.id === undefined ? {} : { id: definition.id }),
        ...ruleSourceMetadata(definition),
        ...(definition.loose === undefined ? {} : { loose: definition.loose }),
      };

const loosenInternalRuleSource = (
  source: string,
  options: InternalProfanityRuleLooseOptions = {},
): string => {
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

    result += loosenRuleAtom(atom, options);
    previousWasWordLike = wordLike;
  }

  return result;
};

const loosenRuleAtom = (
  atom: RuleAtom,
  options: InternalProfanityRuleLooseOptions,
): string => {
  if (isOptionalSuffixAtom(atom)) {
    return loosenOptionalSuffix(atom, options);
  }

  if (isRepeatedWordLikeAtom(atom)) {
    return `${atom.base}(?:${LOOSE_SEPARATOR}${atom.base})*`;
  }

  if (isPlainGroup(atom.base)) {
    return loosenGroup(atom, options);
  }

  if (isStretchableAtom(atom, options)) {
    return `${atom.source}(?:${LOOSE_SEPARATOR}${atom.base})*`;
  }

  return atom.source;
};

const loosenOptionalSuffix = (
  atom: RuleAtom,
  options: InternalProfanityRuleLooseOptions,
): string => {
  const classSource = atom.base.match(/^\(\?:(\[[^\]]+\])\+\)$/u)?.[1];
  // Turn `(?:[а-яё]+)?` into an optional sequence that can consume split suffix
  // letters, for example `за-е-б-а-л`, while staying within the current token.
  return classSource === undefined
    ? loosenGroup(atom, options)
    : `(?:${classSource}(?:${IN_TOKEN_SEPARATOR}${classSource})*)?`;
};

const loosenGroup = (
  atom: RuleAtom,
  options: InternalProfanityRuleLooseOptions,
): string => {
  const prefix = atom.base.startsWith("(?:") ? "(?:" : "(";
  const bodyStart = atom.base.startsWith("(?:") ? 3 : 1;
  const body = atom.base.slice(bodyStart, -1);
  const quantifier = atom.source.slice(atom.base.length);
  // Groups with alternatives such as `(у|ал|нуть)` need the same loose expansion
  // inside each alternative; treating the group as one atom misses `е-б-н-у-т-ь`.
  const alternatives = splitTopLevelAlternatives(body).map((alternative) =>
    loosenInternalRuleSource(alternative, options),
  );

  return `${prefix}${alternatives.join("|")})${quantifier}`;
};

const isPlainGroup = (source: string): boolean =>
  source.startsWith("(") && !/^\(\?<?[=!]/u.test(source);

const isRepeatedWordLikeAtom = (atom: RuleAtom): boolean =>
  atom.source === `${atom.base}+` &&
  isWordLikeAtom(atom) &&
  !isPlainGroup(atom.base);

const isStretchableAtom = (
  atom: RuleAtom,
  options: InternalProfanityRuleLooseOptions,
): boolean =>
  options.stretch === true &&
  atom.source === atom.base &&
  isWordLikeAtom(atom) &&
  !isPlainGroup(atom.base);
