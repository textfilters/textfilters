# @textfilters/core

Core TypeScript primitives for composable text filtering, content moderation,
censoring, redaction, normalization, range masking, and moderation pipelines.

Use `@textfilters/core` as the shared foundation for a TypeScript text filtering
library, chat moderation workflow, UGC moderation service, or custom pipeline
that combines URL detection, email detection, phone number detection, profanity
filtering, and anti-spam checks.

## Installation

The initial `@textfilters/core` release is published as a public package in GitHub Packages.

Add the GitHub Packages registry for the `@textfilters` scope:

```ini
@textfilters:registry=https://npm.pkg.github.com
```

Install with GitHub npm authentication configured. GitHub Packages requires authentication for npm installs, including public packages.

```sh
npm install @textfilters/core
```

## Use Cases

- Compose multiple content moderation filters into one ordered pipeline.
- Apply consistent censoring and redaction over UTF-16 and code point ranges.
- Normalize user-generated text before package-specific matching.
- Share filter contracts across chat moderation and UGC moderation features.

## Usage

```ts
import {
  createCachedTextProcessor,
  createPreparedText,
  createTextRangePipeline,
  createTextPipeline,
  lowerNfkc,
  type AllocationAwareRangeScanner,
  type ScanInput,
  type TextCensor,
  type TextRangeScanner,
} from "@textfilters/core";

const censor: TextCensor = {
  name: "example",
  censor: (text) => text.replaceAll("secret", "******"),
};

const safeText = createTextPipeline().use(censor).censor("secret message");

const normalizeRepeatedText = createCachedTextProcessor(
  (text) => lowerNfkc(text),
  { maxEntries: 256 },
);

const normalized = normalizeRepeatedText.process("ＨＥＬＬＯ");

const scanner: TextRangeScanner = ({ text }) =>
  text.includes("secret") ? [[0, 6]] : [];

const rangeSafeText = createTextRangePipeline()
  .use(scanner)
  .censor("secret message");

const allocationAwareScanner: AllocationAwareRangeScanner = {
  allocationAware: true,
  check: (input) => input.hints.hasDot,
  scan: (input, sink) => {
    const index = input.codePoints.indexOf(".");
    if (index >= 0) sink({ range: [index, index + 1] });
  },
};

const prepared = createPreparedText("a.b");
const hasRange = allocationAwareScanner.check(prepared);
const sharedInput: ScanInput = prepared;
```

## API

- `createTextPipeline()`
- `createTextRangePipeline()`
- `checkTextRanges(value, scanners)`
- `createPreparedText(value)`
- `createTextHints(text, codePoints)`
- `createTextScanInput(value)`
- `createTextRangeScanResult(ranges, metadata)`
- `runTextRangeScanner(scanner, input)`
- `scanPreparedTextRanges(scanner, input, sink)`
- `scanTextRanges(value, scanners)`
- `createCachedTextProcessor(processor, options)`
- `normalizeTextInput(value)`
- `lowerNfkc(value)`
- `stripZeroWidth(value)`
- `normalizeVisibleMaskChar(maskChar)`
- `normalizeLengthPreservingMaskChar(maskChar)`
- `normalizeMaskChar(maskChar)`
- `toCodePoints(value)`
- `mergeRanges(ranges)`
- `mergeCodePointRanges(ranges)`
- `maskRange(value, range, maskChar)`
- `maskRanges(value, ranges, maskChar)`
- `maskCodePointRanges(codePoints, ranges, maskChar)`
- `maskCodePointRangesPreservingLength(codePoints, ranges, maskChar)`
- `censorCodePointRanges(codePoints, ranges, maskChar)`
- `ScanInput`
- `ScanHints`
- `ScanResult`
- `TextRange`

### Public Input Normalization

`normalizeTextInput()` converts public text-like input to a string while mapping
`null` and `undefined` to an empty string. This is the shared public input
contract for textfilters packages: public censor, analyze, and check helpers
should normalize raw caller input with `normalizeTextInput()` before matching or
masking. Non-nullish values use JavaScript string conversion, so numbers,
booleans, symbols, and objects keep the same behavior as `String(value)`.

Matching helpers such as `lowerNfkc()`, `stripZeroWidth()`, and `toCodePoints()`
use the same nullish input behavior.

`createCachedTextProcessor()` creates an opt-in, per-instance bounded cache for
pure repeated text processing. Use it when the same text is normalized, parsed,
or transformed repeatedly with the same configuration. Each helper owns its own
cache, `maxEntries` bounds the retained text entries, and `clear()` drops cached
results without changing configuration.

Do not use `createCachedTextProcessor()` for stateful guard checks, actor-aware
rate limits, time-dependent decisions, or processors whose result depends on
external mutable state. It has no hidden global behavior and does not affect
existing filters unless callers explicitly opt in.

`normalizeVisibleMaskChar()` keeps visible masking to one user-visible code
point. `normalizeMaskChar()` remains a backwards-compatible alias for that
behavior. `normalizeLengthPreservingMaskChar()` is stricter and returns one
UTF-16 code unit, falling back to `*` for empty or astral mask values.

`maskCodePointRanges()` masks each covered code point with one normalized mask
code point and does not split surrogate pairs. This keeps existing callers
stable when code point counts are the intended unit.

`maskCodePointRangesPreservingLength()` is for filters that collect code point
ranges but need censored output to preserve the source UTF-16 string length. It
repeats a BMP mask character by the UTF-16 width of each covered source code
point, so an astral source symbol is replaced by two BMP mask characters. Empty
mask values use `*`. Astral mask characters also fall back to `*` because using
them for BMP source code points would expand the output length.

`censorCodePointRanges()` is the small shared helper for packages that already
collect code point ranges and only need length-preserving censored output. It
returns the original code points joined when there are no ranges and otherwise
delegates to `maskCodePointRangesPreservingLength()`.

### Range Scanner Pipeline

`TextRangeScanner` is the shared scanner contract for packages that collect
code point ranges before masking. A scanner can be a function or an object with
a `scan()` method. Scanners receive `TextScanInput`, which contains the
normalized source text and its code point array.

`PreparedText` extends that input with reusable `TextHints`, including generic
length, ASCII, digit, whitespace, punctuation, and common delimiter facts.
These hints are computed once by `createPreparedText()` and reused across
registered scanners. They are intentionally generic; URL, email, phone,
profanity, spam, and future packages keep their own package-specific detection
logic.

`ScanInput`, `ScanHints`, and `ScanResult` are short shared aliases for the
allocation-aware prepared input, reusable text hints, and pipeline scan result
shape. The longer `PreparedText`, `TextHints`, and
`TextRangePipelineScanResult` names remain supported for existing callers.

`AllocationAwareRangeScanner` separates a cheap pre-scan `check()` gate from
sink-based `scan()`. A true `check()` result means the scanner is eligible to
scan the prepared input; it is not itself proof that a range exists.
`scan()` streams `RangeMatch` values into a `RangeMatchSink`; returning `false`
from the sink requests early stop. Use `createTextRangePipeline().check()` or
`scanPreparedTextRanges()` when callers need to confirm an actual emitted
range. Legacy scanner functions and scanner objects remain supported and
continue to return range arrays or `TextRangeScanResult`.

`createTextRangePipeline()` collects ranges from registered scanners, merges
overlaps in code point order, and masks once with
`censorCodePointRanges()`. This keeps scanner packages independent while
sharing one final masking step. The existing `createTextPipeline()` and
`TextCensor` behavior remain unchanged.

## Related Textfilters Packages

- `@textfilters/url` for URL detection, obfuscated links, and safe link
  censoring.
- `@textfilters/email` for email detection and contact redaction.
- `@textfilters/phone` for phone number detection and contact redaction.
- `@textfilters/profanity` for Russian profanity filtering and taxonomy-backed
  moderation.
- `@textfilters/spam` for actor-based anti-spam guard checks.

## Release

Releases are managed by Release Please from Conventional Commit history on `main`. When a Release Please release is created, the workflow runs `npm run check` and publishes the package to GitHub Packages. Release tags keep the `v*` pattern.

The package is prepared for publication to GitHub Packages, not the public npm registry.

## License

MIT
