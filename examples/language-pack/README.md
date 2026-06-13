# External Language Pack Example

This directory is a minimal, non-published template for a future external
language pack. It is not a workspace package, is not included in package
publishing, and intentionally uses the fake language code `zz`.

## Shape

```text
examples/language-pack/
  src/
    dictionary.ts
    index.ts
```

- `src/dictionary.ts` keeps the human-maintained source dictionary.
- `src/index.ts` validates that dictionary, creates a filter from it, and
  exports both values from the hypothetical package entrypoint.

## Dictionary Source

Language packs should keep source dictionaries small, explicit, and
human-maintained:

```ts
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
  ],
} as const satisfies ProfanityLanguageDictionary;
```

The example terms are neutral placeholders. A real external pack should replace
them with its own reviewed language data and policy tests.

## Package Entrypoint

A future external package can expose a validated dictionary and a ready-to-use
filter from its public entrypoint:

```ts
import {
  createProfanityFilterFromDictionary,
  validateProfanityLanguageDictionary,
} from "@textfilters/profanity";

import { zzProfanityDictionary } from "./dictionary.js";

const validationIssues = validateProfanityLanguageDictionary(
  zzProfanityDictionary,
);

if (validationIssues.length > 0) {
  throw new Error(JSON.stringify(validationIssues, null, 2));
}

export { zzProfanityDictionary };
export const zzProfanityFilter = createProfanityFilterFromDictionary(
  zzProfanityDictionary,
);
```

This repository only provides the template. It does not create, publish, or
reserve a real external language package.
