import { isWhitespace, type EmailTextMeta } from "../../normalization.js";
import { SCANNER_PUNCTUATION, TOKEN_TYPE, type Token } from "../core/types.js";

export const isHorizontalWhitespace = (value: string): boolean =>
  value !== "\n" && value !== "\r" && isWhitespace(value);

export const isSameProsePhrase = (
  meta: EmailTextMeta,
  previous: Token,
  local: Token,
): boolean => {
  for (let i = previous.end; i < local.start; i++) {
    if (meta.zeroWidth[i]) continue;
    if (!isHorizontalWhitespace(meta.normalized[i])) return false;
  }
  return true;
};

export const isAddressListGap = (
  meta: EmailTextMeta,
  previous: Token,
  next: Token,
): boolean => {
  // Lists may include a normal serial comma before the conjunction, but other
  // punctuation should break address-list context.
  for (let i = previous.end; i < next.start; i++) {
    if (meta.zeroWidth[i]) continue;
    const value = meta.normalized[i];
    if (value === SCANNER_PUNCTUATION.comma || isHorizontalWhitespace(value)) {
      continue;
    }
    return false;
  }
  return true;
};

export const previousWordInSamePhrase = (
  meta: EmailTextMeta,
  tokens: readonly Token[],
  index: number,
): Token | undefined => {
  const current = tokens[index];
  const previous = tokens[index - 1];
  if (
    current === undefined ||
    previous?.type !== TOKEN_TYPE.word ||
    !isSameProsePhrase(meta, previous, current)
  ) {
    return undefined;
  }
  return previous;
};
