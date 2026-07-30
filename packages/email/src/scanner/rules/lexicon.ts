import { SCANNER_PUNCTUATION, TOKEN_TYPE, type Token } from "../core/types.js";

export const SCANNER_WORD = {
  a: "a",
  address: "address",
  all: "all",
  an: "an",
  and: "and",
  apply: "apply",
  back: "back",
  bcc: "bcc",
  cc: "cc",
  code: "code",
  contact: "contact",
  down: "down",
  eMail: "e-mail",
  email: "email",
  form: "form",
  forward: "forward",
  from: "from",
  her: "her",
  his: "his",
  hosted: "hosted",
  is: "is",
  it: "it",
  kindly: "kindly",
  located: "located",
  mail: "mail",
  message: "message",
  me: "me",
  my: "my",
  or: "or",
  our: "our",
  out: "out",
  page: "page",
  please: "please",
  reach: "reach",
  reply: "reply",
  replyTo: "reply-to",
  respond: "respond",
  send: "send",
  service: "service",
  shop: "shop",
  shopping: "shopping",
  study: "study",
  that: "that",
  the: "the",
  their: "their",
  this: "this",
  to: "to",
  try: "try",
  us: "us",
  via: "via",
  was: "was",
  work: "work",
  write: "write",
  your: "your",
} as const;

// Inline commands can introduce an obfuscated address without punctuation:
// "email user at example dot com" or "write admin at example dot com".
const EMAIL_INTRODUCER_WORDS: ReadonlySet<string> = new Set([
  SCANNER_WORD.bcc,
  SCANNER_WORD.cc,
  SCANNER_WORD.contact,
  SCANNER_WORD.eMail,
  SCANNER_WORD.email,
  SCANNER_WORD.forward,
  SCANNER_WORD.mail,
  SCANNER_WORD.message,
  SCANNER_WORD.reach,
  SCANNER_WORD.respond,
  SCANNER_WORD.reply,
  SCANNER_WORD.send,
  SCANNER_WORD.try,
  SCANNER_WORD.write,
]);

const DIRECT_EMAIL_INTRODUCER_WORDS: ReadonlySet<string> = new Set([
  SCANNER_WORD.bcc,
  SCANNER_WORD.cc,
  SCANNER_WORD.contact,
  SCANNER_WORD.eMail,
  SCANNER_WORD.email,
  SCANNER_WORD.forward,
  SCANNER_WORD.mail,
  SCANNER_WORD.message,
  SCANNER_WORD.reach,
]);

const PREPOSITIONAL_EMAIL_INTRODUCER_WORDS: ReadonlySet<string> = new Set([
  SCANNER_WORD.bcc,
  SCANNER_WORD.cc,
  SCANNER_WORD.contact,
  SCANNER_WORD.eMail,
  SCANNER_WORD.email,
  SCANNER_WORD.forward,
  SCANNER_WORD.mail,
  SCANNER_WORD.message,
  SCANNER_WORD.respond,
  SCANNER_WORD.reply,
  SCANNER_WORD.send,
  SCANNER_WORD.write,
]);

const OBJECT_PREPOSITIONAL_EMAIL_INTRODUCER_WORDS: ReadonlySet<string> =
  new Set([
    SCANNER_WORD.eMail,
    SCANNER_WORD.email,
    SCANNER_WORD.forward,
    SCANNER_WORD.mail,
    SCANNER_WORD.message,
    SCANNER_WORD.send,
  ]);

const PHRASAL_EMAIL_INTRODUCER_WORDS: ReadonlySet<string> = new Set([
  SCANNER_WORD.reach,
  SCANNER_WORD.reply,
  SCANNER_WORD.respond,
]);

const POSSESSIVE_INTRODUCER_WORDS: ReadonlySet<string> = new Set([
  SCANNER_WORD.her,
  SCANNER_WORD.his,
  SCANNER_WORD.my,
  SCANNER_WORD.our,
  SCANNER_WORD.their,
  SCANNER_WORD.your,
]);

const PREPOSITIONAL_INTRODUCER_WORDS: ReadonlySet<string> = new Set([
  SCANNER_WORD.to,
  SCANNER_WORD.via,
]);

const PHRASAL_PARTICLE_WORDS: ReadonlySet<string> = new Set([
  SCANNER_WORD.all,
  SCANNER_WORD.back,
  SCANNER_WORD.out,
]);

const COPULA_INTRODUCER_WORDS: ReadonlySet<string> = new Set([
  SCANNER_WORD.is,
  SCANNER_WORD.was,
]);
const ADDRESS_NOUN_WORDS: ReadonlySet<string> = new Set([SCANNER_WORD.address]);

// Header labels are intentionally narrower than command introducers. Verbs
// such as try/write may introduce addresses inline, but before a label
// separator they are ordinary prose headings.
const EMAIL_LABEL_WORDS: ReadonlySet<string> = new Set([
  SCANNER_WORD.bcc,
  SCANNER_WORD.cc,
  SCANNER_WORD.contact,
  SCANNER_WORD.eMail,
  SCANNER_WORD.email,
  SCANNER_WORD.from,
  SCANNER_WORD.mail,
  SCANNER_WORD.message,
  SCANNER_WORD.replyTo,
]);

const LABEL_SEPARATOR_WORDS: ReadonlySet<string> = new Set([
  SCANNER_PUNCTUATION.colon,
  SCANNER_PUNCTUATION.hyphen,
]);

const ADDRESS_LIST_CONJUNCTION_WORDS: ReadonlySet<string> = new Set([
  SCANNER_WORD.and,
  SCANNER_WORD.or,
]);

const SENDABLE_OBJECT_WORDS: ReadonlySet<string> = new Set([
  SCANNER_WORD.it,
  SCANNER_WORD.that,
  SCANNER_WORD.this,
]);
const RECIPIENT_OBJECT_WORDS: ReadonlySet<string> = new Set([
  SCANNER_WORD.me,
  SCANNER_WORD.us,
]);

export const COPULA_PROSE_LOCAL_WORDS: ReadonlySet<string> = new Set([
  SCANNER_WORD.down,
  SCANNER_WORD.hosted,
  SCANNER_WORD.located,
]);

const DETERMINER_WORDS: ReadonlySet<string> = new Set([
  SCANNER_WORD.a,
  SCANNER_WORD.an,
  SCANNER_WORD.her,
  SCANNER_WORD.his,
  SCANNER_WORD.my,
  SCANNER_WORD.our,
  SCANNER_WORD.that,
  SCANNER_WORD.the,
  SCANNER_WORD.their,
  SCANNER_WORD.this,
  SCANNER_WORD.your,
]);

const ADJECTIVE_INTRODUCER_WORDS: ReadonlySet<string> = new Set([
  SCANNER_WORD.contact,
  SCANNER_WORD.eMail,
  SCANNER_WORD.email,
  SCANNER_WORD.mail,
  SCANNER_WORD.message,
]);

const COURTESY_COMMAND_WORDS: ReadonlySet<string> = new Set([
  SCANNER_WORD.kindly,
  SCANNER_WORD.please,
]);

// These words are common prose locals around URL-like text. They need explicit
// email context before the scanner may treat them as mailbox local parts.
const PROSE_OBJECT_LOCAL_WORDS: ReadonlySet<string> = new Set([
  SCANNER_WORD.code,
  SCANNER_WORD.form,
  SCANNER_WORD.page,
  SCANNER_WORD.service,
  SCANNER_WORD.shopping,
]);
const SENTENCE_INITIAL_PROSE_LOCAL_WORDS: ReadonlySet<string> = new Set([
  SCANNER_WORD.apply,
  SCANNER_WORD.located,
  SCANNER_WORD.shop,
  SCANNER_WORD.study,
  SCANNER_WORD.work,
]);
const FORWARD_PROSE_LOCAL_WORDS: ReadonlySet<string> = new Set([
  SCANNER_WORD.apply,
  SCANNER_WORD.code,
  SCANNER_WORD.form,
  SCANNER_WORD.page,
  SCANNER_WORD.shop,
  SCANNER_WORD.shopping,
  SCANNER_WORD.study,
  SCANNER_WORD.work,
]);

export const isKnownProseLocal = (token: Token): boolean =>
  PROSE_OBJECT_LOCAL_WORDS.has(token.value) ||
  SENTENCE_INITIAL_PROSE_LOCAL_WORDS.has(token.value);

export const isForwardProseLocal = (token: Token): boolean =>
  FORWARD_PROSE_LOCAL_WORDS.has(token.value);

export const isEmailIntroducer = (token: Token | undefined): boolean =>
  token?.type === TOKEN_TYPE.word && EMAIL_INTRODUCER_WORDS.has(token.value);

export const isDirectEmailIntroducer = (token: Token | undefined): boolean =>
  token?.type === TOKEN_TYPE.word &&
  DIRECT_EMAIL_INTRODUCER_WORDS.has(token.value);

export const isPrepositionalEmailIntroducer = (
  token: Token | undefined,
): boolean =>
  token?.type === TOKEN_TYPE.word &&
  PREPOSITIONAL_EMAIL_INTRODUCER_WORDS.has(token.value);

export const isObjectPrepositionalEmailIntroducer = (
  token: Token | undefined,
): boolean =>
  token?.type === TOKEN_TYPE.word &&
  OBJECT_PREPOSITIONAL_EMAIL_INTRODUCER_WORDS.has(token.value);

export const isPhrasalEmailIntroducer = (token: Token | undefined): boolean =>
  token?.type === TOKEN_TYPE.word &&
  PHRASAL_EMAIL_INTRODUCER_WORDS.has(token.value);

export const isPossessiveIntroducer = (token: Token | undefined): boolean =>
  token?.type === TOKEN_TYPE.word &&
  POSSESSIVE_INTRODUCER_WORDS.has(token.value);

export const isPrepositionalIntroducer = (token: Token | undefined): boolean =>
  token?.type === TOKEN_TYPE.word &&
  PREPOSITIONAL_INTRODUCER_WORDS.has(token.value);

export const isPhrasalParticle = (token: Token | undefined): boolean =>
  token?.type === TOKEN_TYPE.word && PHRASAL_PARTICLE_WORDS.has(token.value);

export const isCopulaIntroducer = (token: Token | undefined): boolean =>
  token?.type === TOKEN_TYPE.word && COPULA_INTRODUCER_WORDS.has(token.value);

export const isAddressNoun = (token: Token | undefined): boolean =>
  token?.type === TOKEN_TYPE.word && ADDRESS_NOUN_WORDS.has(token.value);

export const isEmailLabelWord = (token: Token | undefined): boolean =>
  token?.type === TOKEN_TYPE.word && EMAIL_LABEL_WORDS.has(token.value);

export const isAddressListConjunction = (
  token: Token | undefined,
): token is Token =>
  token?.type === TOKEN_TYPE.word &&
  ADDRESS_LIST_CONJUNCTION_WORDS.has(token.value);

export const isLabelSeparator = (value: string): boolean =>
  LABEL_SEPARATOR_WORDS.has(value);

export const isLabelSeparatorToken = (
  token: Token | undefined,
): token is Token =>
  token?.type === TOKEN_TYPE.word && isLabelSeparator(token.value);

export const isSendableObject = (token: Token | undefined): boolean =>
  token?.type === TOKEN_TYPE.word && SENDABLE_OBJECT_WORDS.has(token.value);

export const isRecipientObject = (token: Token | undefined): boolean =>
  token?.type === TOKEN_TYPE.word && RECIPIENT_OBJECT_WORDS.has(token.value);

export const isDeterminer = (token: Token | undefined): boolean =>
  token?.type === TOKEN_TYPE.word && DETERMINER_WORDS.has(token.value);

export const isCourtesyCommand = (token: Token | undefined): boolean =>
  token?.type === TOKEN_TYPE.word && COURTESY_COMMAND_WORDS.has(token.value);

export const isAdjectiveIntroducerWord = (token: Token): boolean =>
  ADJECTIVE_INTRODUCER_WORDS.has(token.value);
