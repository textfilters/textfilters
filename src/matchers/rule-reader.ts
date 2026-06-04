import {
  readBalanced,
  readEscapeAtom,
  readQuantifier,
} from "./rule-scanner.js";

export interface RuleAtom {
  readonly base: string;
  readonly source: string;
}

export const readRuleAtoms = (source: string): RuleAtom[] => {
  const atoms: RuleAtom[] = [];
  let index = 0;

  // This reader is intentionally small and only supports the controlled syntax
  // used by the built-in corpus. Runtime terms never pass through it.
  while (index < source.length) {
    const char = source[index];

    if (char === "\\") {
      index = pushAtom(atoms, source, readEscapeAtom(source, index));
      continue;
    }

    if (char === "[") {
      index = pushAtom(atoms, source, readBalanced(source, index, "[", "]"));
      continue;
    }

    if (char === "(") {
      index = pushAtom(atoms, source, readBalanced(source, index, "(", ")"));
      continue;
    }

    index = pushAtom(atoms, source, [char, index + 1]);
  }

  return atoms;
};

const pushAtom = (
  atoms: RuleAtom[],
  source: string,
  [base, nextIndex]: [string, number],
): number => {
  const [quantifier, quantifierEnd] = readQuantifier(source, nextIndex);
  atoms.push({ base, source: base + quantifier });
  return quantifierEnd;
};
