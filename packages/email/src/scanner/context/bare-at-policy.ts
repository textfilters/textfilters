import { type EmailTextMeta } from "../../normalization.js";
import { TOKEN_VALUE, type ScannerOptions, type Token } from "../core/types.js";
import { hasAcceptedAddressListContext } from "./address-list.js";
import { hasEmailIntroducerContext } from "./introducers.js";
import {
  hasEmailLabelContext,
  hasNonEmailProseLabelContext,
} from "./labels.js";
import { previousWordInSamePhrase } from "./phrase.js";
import { isKnownProseLocal } from "../rules/lexicon.js";

export const hasBareAtProseLocalContext = (
  meta: EmailTextMeta,
  tokens: readonly Token[],
  index: number,
  local: Token,
): boolean =>
  // Known prose local parts are only rejected at phrase start when there is no
  // explicit email label. This keeps "From: work at ..." masked while leaving
  // "Work at example dot com" and "Service at ..." alone.
  (isKnownProseLocal(local) &&
    previousWordInSamePhrase(meta, tokens, index) === undefined &&
    !hasEmailLabelContext(meta, tokens, index)) ||
  hasNonEmailProseLabelContext(meta, tokens, index, local);

export const isBareAtProsePhrase = (
  meta: EmailTextMeta,
  tokens: readonly Token[],
  index: number,
  local: Token,
  at: Token,
  options: ScannerOptions,
  acceptedListLocalIndexes: ReadonlySet<number>,
): boolean => {
  if (at.value !== TOKEN_VALUE.atWord && at.value !== TOKEN_VALUE.atSymbol) {
    return false;
  }
  if (at.wrapped) return false;
  if (
    hasAcceptedAddressListContext(
      meta,
      tokens,
      index,
      local,
      options,
      acceptedListLocalIndexes,
    )
  ) {
    return false;
  }
  return (
    hasBareAtProseLocalContext(meta, tokens, index, local) ||
    !hasEmailIntroducerContext(
      meta,
      tokens,
      index,
      local,
      options,
      acceptedListLocalIndexes,
    )
  );
};
