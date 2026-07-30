import { isWhitespace, type EmailTextMeta } from "../../normalization.js";
import { TOKEN_TYPE, type Token } from "../core/types.js";
import {
  isAddressNoun,
  isEmailLabelWord,
  isKnownProseLocal,
  isLabelSeparator,
  isLabelSeparatorToken,
  isRecipientObject,
  SCANNER_WORD,
} from "../rules/lexicon.js";
import { previousWordInSamePhrase } from "./phrase.js";

interface LabelCandidate {
  readonly index: number;
  readonly label: Token;
  readonly separatorStart: number;
}

const hasLabelSeparator = (
  meta: EmailTextMeta,
  start: number,
  end: number,
): boolean => {
  // A label can be split from its value by ":" or "-", and values may start on
  // the next line. The separator is required so plain adjacent words do not
  // become labels accidentally.
  let seenLabelSeparator = false;
  for (let i = start; i < end; i++) {
    if (meta.zeroWidth[i]) continue;
    const value = meta.normalized[i];
    if (isLabelSeparator(value)) {
      seenLabelSeparator = true;
      continue;
    }
    if (!isWhitespace(value)) return false;
  }
  return seenLabelSeparator;
};

const isEmailLabel = (
  label: Token | undefined,
  beforeLabel: Token | undefined,
): boolean =>
  isEmailLabelWord(label) ||
  (label?.type === TOKEN_TYPE.word &&
    label.value === SCANNER_WORD.to &&
    (beforeLabel === undefined ||
      (beforeLabel.type === TOKEN_TYPE.word &&
        beforeLabel.value === SCANNER_WORD.reply))) ||
  (isAddressNoun(label) &&
    (beforeLabel === undefined || isEmailLabelWord(beforeLabel))) ||
  (isRecipientObject(label) && isEmailLabelWord(beforeLabel));

const toLabelCandidate = (index: number, label: Token): LabelCandidate => {
  const lastValue = label.value[label.value.length - 1] ?? "";
  if (label.value.length > 1 && isLabelSeparator(lastValue)) {
    return {
      index,
      label: { ...label, value: label.value.slice(0, -1) },
      separatorStart: label.end - 1,
    };
  }

  return {
    index,
    label,
    separatorStart: label.end,
  };
};

const labelCandidateBeforeSeparator = (
  meta: EmailTextMeta,
  tokens: readonly Token[],
  index: number,
): LabelCandidate | undefined => {
  // Hyphen is part of WORD_CHAR_RE, so "Email - user..." can tokenize the
  // separator as a word token. It can also stay attached to the label in
  // "Email- user...". Normalize that attached form before label classification.
  const local = tokens[index];
  let labelIndex = index - 1;
  while (isLabelSeparatorToken(tokens[labelIndex])) labelIndex -= 1;

  const label = tokens[labelIndex];
  if (local === undefined || label?.type !== TOKEN_TYPE.word) return undefined;
  const candidate = toLabelCandidate(labelIndex, label);
  if (!hasLabelSeparator(meta, candidate.separatorStart, local.start)) {
    return undefined;
  }

  return candidate;
};

export const hasEmailLabelContext = (
  meta: EmailTextMeta,
  tokens: readonly Token[],
  index: number,
): boolean => {
  const candidate = labelCandidateBeforeSeparator(meta, tokens, index);
  if (candidate === undefined) return false;
  const beforeLabel = previousWordInSamePhrase(meta, tokens, candidate.index);
  return isEmailLabel(candidate.label, beforeLabel);
};

export const hasNonEmailProseLabelContext = (
  meta: EmailTextMeta,
  tokens: readonly Token[],
  index: number,
  local: Token,
): boolean => {
  // Non-email headings such as "Try:" and "Note:" should preserve known prose
  // locals even when the value looks like an obfuscated address.
  if (!isKnownProseLocal(local)) return false;

  const candidate = labelCandidateBeforeSeparator(meta, tokens, index);
  if (candidate === undefined) return false;

  const beforeLabel = previousWordInSamePhrase(meta, tokens, candidate.index);
  return !isEmailLabel(candidate.label, beforeLabel);
};
