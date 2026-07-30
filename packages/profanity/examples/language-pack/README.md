# External Language Pack Example

This directory is a minimal, non-published package template for a future
external language pack. It is not a workspace package, is not included in
package publishing, and intentionally uses the fake language code `zz`.

## Shape

```text
examples/language-pack/
  package.json
  src/
    dictionary.ts
    index.ts
```

- `package.json` shows hypothetical package metadata for an unpublished
  language pack named `@textfilters/profanity-zz`.
- `src/dictionary.ts` keeps the human-maintained source dictionary.
- `src/index.ts` validates that dictionary, creates a filter and declarative
  profile from it, and exports all three values from the hypothetical package
  entrypoint.

## Starting a Real Workspace

Copy these files into a new workspace under `packages/`:

```text
package.json
src/dictionary.ts
src/index.ts
```

Before publishing a real package, replace every template-only value:

- Change `@textfilters/profanity-zz` to the real package name.
- Replace the placeholder `0.0.0` version with the real initial package
  version.
- Replace the fake `zz` language code, rule ids, categories, severities, and
  placeholder source terms with reviewed language data.
- Replace the in-repository source import in `src/index.ts` with the real
  package import from `@textfilters/profanity`.
- Remove `private: true` only when the package is ready to publish and the
  target registry, access level, license, README, tests, and release workflow
  are configured in the real repository.
- Add the real package build and test tooling in that repository. This example
  intentionally does not add a build framework or dependencies.

The example `exports` map demonstrates three public surfaces:

```json
{
  ".": "./dist/index.js",
  "./dictionary": "./dist/dictionary.js",
  "./filter": "./dist/index.js"
}
```

## Dictionary Source

Language packs should keep source dictionaries small, explicit, and
human-maintained:

```ts
import type { ProfanityLanguageDictionary } from "@textfilters/profanity";

export const zzProfanityDictionary = {
  language: "zz",
  normalization: "latin-preserving",
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
them with its own reviewed language data and policy tests, and select either
`latin-preserving` or `cyrillic-homoglyphs` based on reviewed language policy.

## Validation

Run the example validator from this repository with the focused test:

```bash
npm test -- tests/language-pack-example.spec.ts
```

The test imports the example package entrypoint and confirms that
`validateProfanityLanguageDictionary` accepts the dictionary before a filter is
created from it.

In a real external package, keep the same validation step in that package's test
suite or run a compiled entrypoint that calls
`validateProfanityLanguageDictionary` before exporting the filter.

If the package keeps its source dictionary in JSON, validate it with the package
CLI before release:

```bash
profanity-validate-language-dictionary --format json --pretty path/to/profanity.json
```

CI should use `--format json` without `--pretty` when another step reads the
report. Text output remains the default for local terminal use.

## Package Entrypoint

A future external package can expose a validated dictionary, a ready-to-use
filter, and a declarative profile from its public entrypoint:

```ts
import {
  createProfanityFilterFromDictionary,
  defineProfanityLanguageProfile,
  validateProfanityLanguageDictionary,
} from "../../../src/index.js";

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
export const zzProfanityProfile = defineProfanityLanguageProfile({
  id: "zz:default",
  languageTag: "zz",
  filter: zzProfanityFilter,
});
```

In a real external package, replace `../../../src/index.js` with
`@textfilters/profanity` after adding the package dependency in that repository.

This repository only provides the template. It does not create, publish, or
reserve a real external language package.
