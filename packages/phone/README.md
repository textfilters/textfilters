# `@textfilters/phone`

Stateless phone-like sequence filtering with common date, time, coordinate, IP,
balance, and technical-sequence false-positive guards.

## Installation

```sh
npm install @textfilters/phone
```

## Usage

```ts
import { filter as phone } from "@textfilters/phone";

const result = phone.process("Call +1 202 555 0187", "#");
```

The package has no factory options. Use the shared immutable `filter` and pass a
custom mask directly to `censor()` or `process()`.

The detector accepts common Russian and international formats and returns
UTF-16 source offsets. It is designed for user text, not serialized machine
payloads. Parse structured data first and pass only the user-controlled string
fields that require moderation.

The detector does not validate whether a number is assigned or reachable.
Public methods accept strings only.

See [architecture](https://github.com/textfilters/textfilters/blob/main/packages/phone/docs/architecture.md) for internal matching ownership and
[the release process](https://github.com/textfilters/textfilters/blob/main/packages/phone/docs/release-process.md) for release details.
