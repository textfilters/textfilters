import { compilePatternDefinitions, type CompiledPattern } from "./compile.js";
import { LOOSE_SEPARATOR } from "./literals.js";
import { isOptionalSuffixAtom, isWordLikeAtom } from "./rule-classifier.js";
import { readRuleAtoms, type RuleAtom } from "./rule-reader.js";
import { ruleIdentityMetadata, ruleSourceMetadata } from "./rule-metadata.js";
import { splitTopLevelAlternatives } from "./rule-scanner.js";
import type { ProfanityTaxonomyMetadata } from "../types.js";

const IN_TOKEN_SEPARATOR = String.raw`[./@*#\uFFFF\p{S}\p{M}\p{Cf}\p{Pc}-]*`;

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
  readonly hyphenTail?: boolean;
  readonly hyphenTailMin?: number;
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
      trimHyphenTail: rule.loose?.hyphenTail,
      trimHyphenTailMin: rule.loose?.hyphenTailMin,
      ruleId: rule.id,
      ...ruleIdentityMetadata(rule),
    })),
    false,
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

export const loosenInternalRuleSource = (
  source: string,
  options: InternalProfanityRuleLooseOptions = {},
): string => {
  let previousAtom: RuleAtom | null = null;
  let result = "";

  for (const atom of readRuleAtoms(source)) {
    const separator = looseSeparatorBefore(previousAtom, atom);

    result += isOptionalSuffixAtom(atom)
      ? loosenOptionalSuffix(atom, options, separator)
      : `${separator}${loosenRuleAtom(atom, options)}`;
    previousAtom = atom;
  }

  return result;
};

const looseSeparatorBefore = (
  previous: RuleAtom | null,
  current: RuleAtom,
): string => {
  if (
    previous === null ||
    !isWordLikeAtom(previous) ||
    !isWordLikeAtom(current)
  ) {
    return "";
  }

  return separatorBeforeWordLikeAtom(current);
};

const loosenRuleAtom = (
  atom: RuleAtom,
  options: InternalProfanityRuleLooseOptions,
): string => {
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
  leadingSeparator: string,
): string => {
  const classSource = atom.base.match(/^\(\?:(\[[^\]]+\])\+\)$/u)?.[1];

  if (classSource !== undefined) {
    // Open-ended suffixes may split only through separators that remain
    // inside a token; prose delimiters must end the match.
    return `(?:${leadingSeparator}${classSource}(?:${IN_TOKEN_SEPARATOR}${classSource})*)?`;
  }

  // Finite reviewed suffixes may use safe in-token obfuscation separators, but
  // the separator remains inside the optional branch and excludes prose
  // delimiters such as commas, quotes, and en/em dashes.
  const requiredGroup = loosenGroup(
    { base: atom.base, source: atom.base },
    options,
  );

  return `(?:${leadingSeparator}${requiredGroup})?`;
};

const separatorBeforeWordLikeAtom = (atom: RuleAtom): string =>
  // Optional suffixes should allow punctuation inside the same obfuscated word
  // but must not cross whitespace into the next word.
  isOptionalSuffixAtom(atom) ? IN_TOKEN_SEPARATOR : LOOSE_SEPARATOR;

const loosenGroup = (
  atom: RuleAtom,
  options: InternalProfanityRuleLooseOptions,
): string => {
  const prefix = atom.base.startsWith("(?:") ? "(?:" : "(";
  const bodyStart = atom.base.startsWith("(?:") ? 3 : 1;
  const body = atom.base.slice(bodyStart, -1);
  const quantifier = atom.source.slice(atom.base.length);
  // Groups with alternatives need the same loose expansion inside each
  // alternative; treating the group as one atom misses split suffix variants.
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
