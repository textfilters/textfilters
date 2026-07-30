import { readRuleAtoms, type RuleAtom } from "./rule-reader.js";
import { splitTopLevelAlternatives } from "./rule-scanner.js";

export const isOptionalSuffixAtom = (atom: RuleAtom): boolean =>
  /^\(\?:\[[^\]]+\]\+\)\?$/u.test(atom.source) ||
  (atom.source === `${atom.base}?` &&
    atom.base.startsWith("(") &&
    !/^\(\?<?[=!]/u.test(atom.base) &&
    isWordLikeGroup(atom.base));

export const isWordLikeAtom = (atom: RuleAtom): boolean => {
  // The loose transformer only inserts separators around atoms that behave like
  // letters/digits in the controlled built-in corpus.
  if (atom.base.startsWith("\\")) {
    return isWordLikeEscape(atom.base);
  }

  if (atom.base.startsWith("[")) {
    return isWordLikeClass(atom.base);
  }

  if (atom.base.startsWith("(")) {
    return isWordLikeGroup(atom.base);
  }

  return /[\p{L}\p{N}]/u.test(atom.base);
};

const isWordLikeEscape = (atom: string): boolean =>
  /^\\(?:d|w)$/u.test(atom) ||
  /^\\p\{(?:L|Letter|Script=Cyrl|Script_Extensions=Cyrl|N|Number|M|Mark)\}$/u.test(
    atom,
  ) ||
  /^\\u\{[0-9a-fA-F]+\}$/u.test(atom);

const isWordLikeClass = (atom: string): boolean => {
  if (atom.startsWith("[^")) {
    return false;
  }

  // A class that can consume punctuation must not borrow loose spacing from a
  // word-like branch; built-in rules keep these classes separate.
  const body = atom.slice(1, -1);
  const hasPunctuationLiteral = /[.!?,:;()[\]{}|/]/u.test(body);

  return (
    !hasPunctuationLiteral &&
    (/[\p{L}\p{N}]/u.test(atom) ||
      /\\(?:d|w|p\{(?:L|Letter|N|Number)\})/u.test(atom))
  );
};

const isWordLikeGroup = (atom: string): boolean => {
  if (/^\(\?<?[=!]/u.test(atom)) {
    return false;
  }

  const body = atom.startsWith("(?:") ? atom.slice(3, -1) : atom.slice(1, -1);
  // Every branch must be word-like; otherwise a punctuation branch would inherit
  // spacing from a letter branch and match text the rule never intended.
  return splitTopLevelAlternatives(body).every((alternative) =>
    readRuleAtoms(alternative).some(isWordLikeAtom),
  );
};
