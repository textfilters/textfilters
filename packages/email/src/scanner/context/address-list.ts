import { type EmailTextMeta } from "../../normalization.js";
import {
  SCANNER_PUNCTUATION,
  TOKEN_TYPE,
  type ScannerOptions,
  type Token,
} from "../core/types.js";
import { isAddressListGap, isSameProsePhrase } from "./phrase.js";
import { isAddressListConjunction } from "../rules/lexicon.js";
import { isValidDomain, isValidLocal } from "../rules/validators.js";

const hasCommaSeparator = (
  meta: EmailTextMeta,
  previous: Token,
  next: Token,
): boolean => {
  for (let i = previous.end; i < next.start; i++) {
    if (meta.zeroWidth[i]) continue;
    if (meta.normalized[i] === SCANNER_PUNCTUATION.comma) return true;
  }
  return false;
};

const previousObfuscatedAddressLocalIndex = (
  tokens: readonly Token[],
  endIndex: number,
  options: ScannerOptions,
): number | undefined => {
  // Walk backward over "label dot label" domain tokens to find the local part
  // before the matching "at". This is only used for list-context inheritance.
  let cursor = endIndex;
  const lastLabel = tokens[cursor];
  if (lastLabel?.type !== TOKEN_TYPE.word) return undefined;

  const labels = [lastLabel.value];
  cursor -= 1;
  while (
    tokens[cursor]?.type === TOKEN_TYPE.dot &&
    tokens[cursor - 1]?.type === TOKEN_TYPE.word
  ) {
    labels.unshift(tokens[cursor - 1].value);
    cursor -= 2;
  }

  if (!isValidDomain(labels, options)) return undefined;
  if (tokens[cursor]?.type !== TOKEN_TYPE.at) return undefined;

  const localIndex = cursor - 1;
  const local = tokens[localIndex];
  if (
    local?.type !== TOKEN_TYPE.word ||
    local.value.length < 3 ||
    !isValidLocal(local.value)
  ) {
    return undefined;
  }

  return localIndex;
};

export const previousAddressListLocalIndex = (
  meta: EmailTextMeta,
  tokens: readonly Token[],
  index: number,
  local: Token,
  options: ScannerOptions,
  acceptedListLocalIndexes: ReadonlySet<number>,
): number | undefined => {
  const previousIndex = index - 1;
  const previous = tokens[previousIndex];
  const hasConjunction = isAddressListConjunction(previous);
  if (hasConjunction && !isSameProsePhrase(meta, previous, local)) {
    return undefined;
  }

  const priorEndIndex = hasConjunction ? previousIndex - 1 : previousIndex;
  const priorEnd = tokens[priorEndIndex];
  if (priorEnd === undefined) {
    return undefined;
  }

  const hasListSeparator = hasConjunction
    ? isAddressListGap(meta, priorEnd, previous)
    : isAddressListGap(meta, priorEnd, local) &&
      hasCommaSeparator(meta, priorEnd, local);
  if (!hasListSeparator) return undefined;

  const priorLocalIndex = previousObfuscatedAddressLocalIndex(
    tokens,
    priorEndIndex,
    options,
  );
  if (priorLocalIndex === undefined) return undefined;
  if (!acceptedListLocalIndexes.has(priorLocalIndex)) return undefined;

  return priorLocalIndex;
};

export const hasAcceptedAddressListContext = (
  meta: EmailTextMeta,
  tokens: readonly Token[],
  index: number,
  local: Token,
  options: ScannerOptions,
  acceptedListLocalIndexes: ReadonlySet<number>,
): boolean =>
  previousAddressListLocalIndex(
    meta,
    tokens,
    index,
    local,
    options,
    acceptedListLocalIndexes,
  ) !== undefined;
