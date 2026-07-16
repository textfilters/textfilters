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
        source: "fuck(?:ed|ing)?",
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
        source: "dick",
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
        source: "bitch",
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
        source: "suck",
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
        source: "faggot",
        match: { strict: {}, loose: {} },
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
