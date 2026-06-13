import type { ProfanityLanguageDictionary } from "@textfilters/profanity";

export const zzProfanityDictionary = {
  language: "zz",
  rules: [
    {
      id: "zz.vulgar.qwr",
      category: "VULGAR",
      severity: "low",
      source: "qwr",
      match: {
        strict: {},
        loose: {
          stretch: true,
        },
      },
    },
    {
      id: "zz.euphemism.vnn",
      category: "EUPHEMISM",
      severity: "soft",
      source: "vnn",
      match: {
        strict: {},
      },
    },
  ],
} as const satisfies ProfanityLanguageDictionary;
