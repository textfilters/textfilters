# Built-In Taxonomy And Severity Policy

This document defines the package-owned taxonomy for every built-in Russian and
English rule. It classifies matching rules; it does not prescribe a product's
final moderation action.

## Severity Scale

Severity is ordered as `soft < low < medium < high`.

| Severity | Built-in classification                                                           |
| -------- | --------------------------------------------------------------------------------- |
| `high`   | Core explicit obscenity and the most severe direct or identity-targeting insults. |
| `medium` | Obscene derivatives, explicit anatomy, and ordinary direct vulgar insults.        |
| `low`    | Everyday scatology, non-directed body or sexual vulgarity, and weak insults.      |
| `soft`   | Shortened substitutes, euphemisms, and deliberately softened expletives.          |

Use the weakest severity that accurately represents the expression. Severity
must not encode matcher confidence, obfuscation, transliteration, or whether a
rule uses the strict or loose matcher.

Representative Russian classifications are:

- `high`: `бля`, core `бляд`, `пиздец`, and direct core mat roots;
- `medium`: `прихуел`, `хуйня`, `сука`, and `гандон`;
- `low`: `говно`, `жопа`, `сру`, `дрочить`, and `хер`;
- `soft`: `лять`, `ёпт`, and `пох`.

Representative English classifications are:

- `high`: `fuck`, `motherfucker`, and identity-targeting slurs;
- `medium`: `dick`, `cock`, `dickhead`, `bitch`, and `asshole`;
- `low`: `shit`, `suck`, and `bastard`.

## Categories

Category and severity are separate dimensions:

| Category        | Meaning                                                                     | Allowed built-in severities |
| --------------- | --------------------------------------------------------------------------- | --------------------------- |
| `OBSCENE_MAT`   | Direct obscene roots or explicit obscene anatomy.                           | `medium`, `high`            |
| `STRONG_INSULT` | Direct degrading insults, including the current reviewed slur set.          | `low`, `medium`, `high`     |
| `VULGAR`        | Rude, scatological, sexual, or derivative expressions below core obscenity. | `low`, `medium`             |
| `EUPHEMISM`     | Intentionally softened or shortened substitutes.                            | `soft`, `low`               |

A category does not force one severity. For example, a direct insult can be
`low`, `medium`, or `high`, while a Russian core mat root and an English
anatomical term can both be `OBSCENE_MAT` with different severities.

## Rule Consistency

All built-in rules must carry `id`, `category`, and `severity` metadata.

Rules that represent the same lexical expression must keep the same category
and severity across strict, loose, split, homoglyph, digit, stretched, and
transliterated views. Matcher mode describes how a range was found and must not
change what the expression means.

When several rules accept the same source range, their taxonomy must agree.
Representative overlap locks cover `бляд`, `пиздец`, and `хуйня`.

## Compatibility

Calls without taxonomy options preserve the package's default detection and
masking behavior. Reclassification changes only metadata and the results of
`categories`, `severities`, and `minSeverity` filters.

The current audit intentionally changes taxonomy filtering behavior:

- the `бля` family and `пиздец` are included by `minSeverity: "high"`;
- `прихуел`, `хуйня`, `сука`, and `гандон` remain below `high`;
- Russian scatology, `жопа`, and `дрочить` are below `medium`;
- euphemisms are separated from direct vulgarity;
- English scatology, anatomy, verbs, and insults use the same scale boundaries.

Category changes also rename diagnostic rule ids so their namespace continues
to describe the rule. The migration mappings are:

| Previous id             | Current id                                 |
| ----------------------- | ------------------------------------------ |
| `ru.obscene.lyat`       | `ru.euphemism.lyat`                        |
| `ru.vulgar.poh`         | `ru.euphemism.poh`                         |
| `ru.vulgar.yopt.family` | `ru.euphemism.yopt.family`                 |
| `ru.vulgar.her.*`       | `ru.euphemism.her.*`                       |
| `ru.vulgar.heret.*`     | `ru.euphemism.heret.*`                     |
| `ru.vulgar.oheret.*`    | `ru.euphemism.oheret.*`                    |
| `ru.vulgar.pizdec.*`    | `ru.obscene.pizdec.*`                      |
| `en.obscene.shit`       | `en.vulgar.shit`                           |
| `en.vulgar.dick`        | `en.obscene.dick` and `en.insult.dickhead` |
| `en.vulgar.cock`        | `en.obscene.cock`                          |

Consumers that filter by taxonomy must review these changes before upgrading.
Consumers that inspect `ruleId` should treat the renamed ids and the split
`dickhead` rule as a migration requirement.
