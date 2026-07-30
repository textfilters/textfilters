import type { ProfanityLanguageDictionary } from "../profanity.js";

export const createReviewedEnglishProfanityDictionary = () =>
  ({
    language: "en",
    normalization: "latin-preserving",
    rules: [
      {
        id: "en.obscene.fuck.family",
        category: "OBSCENE_MAT",
        severity: "high",
        source: "(?:f[uυ]ck(?:ed|[iι]ng|en)?|f[aα]ck|f[iι]ck)",
        match: { strict: {}, loose: {} },
      },
      {
        id: "en.obscene.shit",
        category: "OBSCENE_MAT",
        severity: "high",
        source: "shit",
        match: { strict: {}, loose: {} },
      },
      {
        id: "en.vulgar.dick",
        category: "VULGAR",
        severity: "medium",
        source: "d[iι]ck(?:heads?)?",
        match: { strict: {} },
      },
      {
        id: "en.insult.motherfucker",
        category: "STRONG_INSULT",
        severity: "high",
        source: "motherfucker",
        match: { strict: {} },
      },
      {
        id: "en.vulgar.cock",
        category: "VULGAR",
        severity: "medium",
        source: "cock",
        match: { strict: {} },
      },
      {
        id: "en.insult.bitch",
        category: "STRONG_INSULT",
        severity: "medium",
        source: "b[iι]t?ch",
        match: { strict: {}, loose: {} },
      },
      {
        id: "en.insult.whore",
        category: "STRONG_INSULT",
        severity: "high",
        source: "whore",
        match: { strict: {}, loose: {} },
      },
      {
        id: "en.insult.nigga",
        category: "STRONG_INSULT",
        severity: "high",
        source: "nigga",
        match: { strict: {}, loose: {} },
      },
      {
        id: "en.vulgar.suck",
        category: "VULGAR",
        severity: "medium",
        source: "s[uυ]ck(?:ed|[iι]ng)?",
        match: { strict: {}, loose: {} },
      },
      {
        id: "en.insult.fag",
        category: "STRONG_INSULT",
        severity: "high",
        source: "fag",
        match: { strict: {}, loose: {} },
      },
      {
        id: "en.insult.faggot",
        category: "STRONG_INSULT",
        severity: "high",
        source: "f[aα]ggots?",
        match: { strict: {}, loose: {} },
      },
      {
        id: "en.insult.asshole",
        category: "STRONG_INSULT",
        severity: "high",
        source: "[aα]ssholes?",
        match: { strict: {} },
      },
      {
        id: "en.insult.bastard",
        category: "STRONG_INSULT",
        severity: "medium",
        source: "bastard",
        match: { strict: {} },
      },
    ],
  }) as const satisfies ProfanityLanguageDictionary;

export const englishProfanityDictionary =
  createReviewedEnglishProfanityDictionary();
