import type { ProfanityLanguageDictionary } from "@textfilters/profanity";

export const englishProfanityDictionary = {
  language: "en",
  rules: [
    {
      id: "en.obscene.fuck.family",
      category: "OBSCENE_MAT",
      severity: "high",
      source: "fuck(?:ed|ing)?",
      match: { strict: {} },
    },
    {
      id: "en.obscene.shit",
      category: "OBSCENE_MAT",
      severity: "high",
      source: "shit",
      match: { strict: {} },
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
} as const satisfies ProfanityLanguageDictionary;
