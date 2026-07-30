import { type EmailTextMeta } from "../../normalization.js";
import { hasAcceptedAddressListContext } from "./address-list.js";
import { hasEmailLabelContext } from "./labels.js";
import { previousWordInSamePhrase } from "./phrase.js";
import { TOKEN_TYPE, type ScannerOptions, type Token } from "../core/types.js";
import {
  COPULA_PROSE_LOCAL_WORDS,
  SCANNER_WORD,
  isAddressNoun,
  isAdjectiveIntroducerWord,
  isCopulaIntroducer,
  isCourtesyCommand,
  isDeterminer,
  isDirectEmailIntroducer,
  isEmailIntroducer,
  isForwardProseLocal,
  isKnownProseLocal,
  isObjectPrepositionalEmailIntroducer,
  isPhrasalEmailIntroducer,
  isPhrasalParticle,
  isPossessiveIntroducer,
  isPrepositionalEmailIntroducer,
  isPrepositionalIntroducer,
  isRecipientObject,
  isSendableObject,
} from "../rules/lexicon.js";

const isContactResourcePhrase = (
  introducer: Token | undefined,
  object: Token | undefined,
  local: Token,
): boolean =>
  introducer?.type === TOKEN_TYPE.word &&
  introducer.value === SCANNER_WORD.contact &&
  isRecipientObject(object) &&
  isKnownProseLocal(local);

const isDeterminerLedEmailObjectPhrase = (
  introducer: Token | undefined,
  determiner: Token | undefined,
  local: Token,
): boolean =>
  isDirectEmailIntroducer(introducer) &&
  isDeterminer(determiner) &&
  !isKnownProseLocal(local);

const isPlainAddressIntroducer = (token: Token | undefined): boolean =>
  token === undefined || token.type === TOKEN_TYPE.word;

const isAddressCopulaIntroducer = (
  token: Token | undefined,
  local: Token,
): boolean =>
  isEmailIntroducer(token) ||
  (isPlainAddressIntroducer(token) && !isKnownProseLocal(local));

const hasCommandContextBeforePrepositionalIntroducer = (
  previous: Token | undefined,
  previousPrevious: Token | undefined,
): boolean =>
  previous === undefined ||
  isCourtesyCommand(previous) ||
  isPrepositionalEmailIntroducer(previous) ||
  (isDeterminer(previous) && isPrepositionalEmailIntroducer(previousPrevious));

const isPrepositionalResourcePhrase = (
  preposition: Token,
  introducer: Token | undefined,
  previous: Token | undefined,
  previousPrevious: Token | undefined,
  local: Token,
): boolean => {
  // A preposition after an email verb is not always an address handoff:
  // "respond to work at ..." and "contact via form at ..." are resource prose.
  if (!isKnownProseLocal(local)) return false;
  if (introducer?.type !== TOKEN_TYPE.word) return false;
  if (preposition.value === SCANNER_WORD.via) return true;
  if (introducer.value === SCANNER_WORD.respond) return true;
  if (introducer.value === SCANNER_WORD.forward)
    return isForwardProseLocal(local);
  if (
    (introducer.value === SCANNER_WORD.eMail ||
      introducer.value === SCANNER_WORD.email ||
      introducer.value === SCANNER_WORD.mail ||
      introducer.value === SCANNER_WORD.message ||
      introducer.value === SCANNER_WORD.contact) &&
    !hasCommandContextBeforePrepositionalIntroducer(previous, previousPrevious)
  ) {
    return true;
  }
  return false;
};

const isAdjectivalEmailIntroducer = (
  token: Token,
  previous: Token | undefined,
  local: Token,
): boolean =>
  isAdjectiveIntroducerWord(token) &&
  (isDeterminer(previous) ||
    (previous !== undefined &&
      !isEmailIntroducer(previous) &&
      !isCourtesyCommand(previous) &&
      isKnownProseLocal(local)));

const hasPrepositionalNounObjectContext = (
  preposition: Token,
  object: Token | undefined,
  beforeObject: Token | undefined,
  beforeBeforeObject: Token | undefined,
  local: Token,
): boolean => {
  if (preposition.value !== SCANNER_WORD.to) return false;
  if (object?.type !== TOKEN_TYPE.word || isKnownProseLocal(local)) {
    return false;
  }
  return (
    isObjectPrepositionalEmailIntroducer(beforeObject) ||
    (isDeterminer(beforeObject) &&
      isObjectPrepositionalEmailIntroducer(beforeBeforeObject))
  );
};

const hasPrepositionalEmailIntroducerContext = (
  meta: EmailTextMeta,
  tokens: readonly Token[],
  index: number,
  local: Token,
): boolean => {
  const preposition = tokens[index];
  if (!isPrepositionalIntroducer(preposition)) return false;

  const beforePreposition = previousWordInSamePhrase(meta, tokens, index);
  const beforeBeforePreposition = previousWordInSamePhrase(
    meta,
    tokens,
    index - 1,
  );
  const beforeBeforeBeforePreposition = previousWordInSamePhrase(
    meta,
    tokens,
    index - 2,
  );
  if (isPrepositionalEmailIntroducer(beforePreposition)) {
    return !isPrepositionalResourcePhrase(
      preposition,
      beforePreposition,
      beforeBeforePreposition,
      beforeBeforeBeforePreposition,
      local,
    );
  }
  if (isSendableObject(beforePreposition)) {
    return (
      isPrepositionalEmailIntroducer(beforeBeforePreposition) &&
      !isKnownProseLocal(local)
    );
  }
  if (
    hasPrepositionalNounObjectContext(
      preposition,
      beforePreposition,
      beforeBeforePreposition,
      beforeBeforeBeforePreposition,
      local,
    )
  ) {
    return true;
  }
  return (
    isPhrasalParticle(beforePreposition) &&
    isPhrasalEmailIntroducer(beforeBeforePreposition) &&
    !isKnownProseLocal(local)
  );
};

export const hasEmailIntroducerContext = (
  meta: EmailTextMeta,
  tokens: readonly Token[],
  index: number,
  local: Token,
  options: ScannerOptions,
  acceptedListLocalIndexes: ReadonlySet<number>,
): boolean => {
  if (hasEmailLabelContext(meta, tokens, index)) return true;

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
    return true;
  }

  const previous = previousWordInSamePhrase(meta, tokens, index);
  if (previous === undefined) return true;

  const beforePrevious = previousWordInSamePhrase(meta, tokens, index - 1);
  if (isEmailIntroducer(previous)) {
    return (
      (isDirectEmailIntroducer(previous)
        ? !(
            (previous.value === SCANNER_WORD.forward ||
              previous.value === SCANNER_WORD.reach) &&
            isForwardProseLocal(local)
          )
        : !isKnownProseLocal(local)) &&
      !isAdjectivalEmailIntroducer(previous, beforePrevious, local)
    );
  }

  const beforeBeforePrevious = previousWordInSamePhrase(
    meta,
    tokens,
    index - 2,
  );
  if (hasPrepositionalEmailIntroducerContext(meta, tokens, index - 1, local)) {
    return true;
  }
  if (
    isRecipientObject(previous) &&
    isEmailIntroducer(beforePrevious) &&
    !isContactResourcePhrase(beforePrevious, previous, local)
  ) {
    return true;
  }
  if (isDeterminerLedEmailObjectPhrase(beforePrevious, previous, local)) {
    return true;
  }

  if (
    isCopulaIntroducer(previous) &&
    isEmailIntroducer(beforePrevious) &&
    !COPULA_PROSE_LOCAL_WORDS.has(local.value)
  ) {
    return true;
  }
  if (
    isCopulaIntroducer(previous) &&
    isAddressNoun(beforePrevious) &&
    isAddressCopulaIntroducer(beforeBeforePrevious, local) &&
    !COPULA_PROSE_LOCAL_WORDS.has(local.value)
  ) {
    return true;
  }

  if (
    isPossessiveIntroducer(previous) &&
    ((beforePrevious === undefined && !isKnownProseLocal(local)) ||
      isEmailIntroducer(beforePrevious) ||
      hasPrepositionalEmailIntroducerContext(meta, tokens, index - 2, local))
  ) {
    return true;
  }

  return false;
};
