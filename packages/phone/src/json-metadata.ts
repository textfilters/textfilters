import { type TextMeta } from "./meta.js";

type JsonNumericMetadataKey = "cursor" | "serverTs";

interface JsonNumericMetadata {
  readonly key: JsonNumericMetadataKey;
  readonly keyStart: number;
  readonly quoted: boolean;
}

interface JsonMetadataObjectValidation {
  readonly end: number;
}

const JSON_WHITESPACE = new Set([" ", "\t", "\n", "\r"]);
const JSON_METADATA_OBJECT_CACHE = new WeakMap<
  TextMeta,
  Map<number, JsonMetadataObjectValidation | null>
>();

const skipJsonWhitespaceBackward = (meta: TextMeta, start: number): number => {
  let cursor = start;
  while (cursor >= 0 && JSON_WHITESPACE.has(meta.codePoints[cursor])) {
    cursor--;
  }
  return cursor;
};

const isEscapedJsonQuote = (meta: TextMeta, quotePosition: number): boolean => {
  let slashCount = 0;
  for (
    let cursor = quotePosition - 1;
    cursor >= 0 && meta.codePoints[cursor] === "\\";
    cursor--
  ) {
    slashCount++;
  }
  return slashCount % 2 === 1;
};

const jsonStringStartBefore = (
  meta: TextMeta,
  closingQuote: number,
): number | null => {
  for (let cursor = closingQuote - 1; cursor >= 0; cursor--) {
    if (meta.codePoints[cursor] === '"' && !isEscapedJsonQuote(meta, cursor)) {
      return cursor;
    }
  }
  return null;
};

const decodeJsonMetadataKey = (
  meta: TextMeta,
  openingQuote: number,
  closingQuote: number,
): JsonNumericMetadataKey | null => {
  const encodedKey = meta.codePoints
    .slice(openingQuote, closingQuote + 1)
    .join("");

  if (encodedKey === '"cursor"') return "cursor";
  if (encodedKey === '"serverTs"') return "serverTs";

  try {
    const decodedKey: unknown = JSON.parse(encodedKey);
    return decodedKey === "cursor" || decodedKey === "serverTs"
      ? decodedKey
      : null;
  } catch {
    return null;
  }
};

export const jsonNumericMetadataKeyBefore = (
  meta: TextMeta,
  start: number,
): JsonNumericMetadata | null => {
  let cursor = start - 1;
  let quoted = false;

  if (cursor >= 0 && meta.codePoints[cursor] === '"') {
    quoted = true;
    cursor--;
  }
  cursor = skipJsonWhitespaceBackward(meta, cursor);
  if (cursor < 0 || meta.codePoints[cursor] !== ":") {
    return null;
  }

  cursor = skipJsonWhitespaceBackward(meta, cursor - 1);
  if (
    cursor < 0 ||
    meta.codePoints[cursor] !== '"' ||
    isEscapedJsonQuote(meta, cursor)
  ) {
    return null;
  }

  const closingQuote = cursor;
  const openingQuote = jsonStringStartBefore(meta, closingQuote);
  if (openingQuote === null) {
    return null;
  }

  cursor = skipJsonWhitespaceBackward(meta, openingQuote - 1);
  if (
    cursor >= 0 &&
    meta.codePoints[cursor] !== "{" &&
    meta.codePoints[cursor] !== ","
  ) {
    return null;
  }

  const key = decodeJsonMetadataKey(meta, openingQuote, closingQuote);
  return key === null ? null : { key, keyStart: openingQuote, quoted };
};

const jsonObjectStartBefore = (
  meta: TextMeta,
  position: number,
): number | null => {
  let depth = 0;
  let inString = false;

  for (let cursor = position - 1; cursor >= 0; cursor--) {
    const codePoint = meta.codePoints[cursor];
    if (codePoint === '"' && !isEscapedJsonQuote(meta, cursor)) {
      inString = !inString;
      continue;
    }
    if (inString) continue;

    if (codePoint === "}") {
      depth++;
    } else if (codePoint === "{") {
      if (depth === 0) return cursor;
      depth--;
    }
  }

  return null;
};

type JsonObjectState =
  | "first-key-or-end"
  | "key"
  | "colon"
  | "value"
  | "comma-or-end";
type JsonArrayState = "first-value-or-end" | "value" | "comma-or-end";

interface JsonObjectNode {
  readonly children: JsonObjectNode[];
  end: number | null;
  readonly keyStarts: number[];
  readonly parent: JsonObjectNode | null;
  readonly start: number;
  syntaxValid: boolean;
}

type JsonContainer =
  | {
      readonly kind: "array";
      state: JsonArrayState;
      valid: boolean;
    }
  | {
      readonly kind: "object";
      readonly node: JsonObjectNode;
      state: JsonObjectState;
      valid: boolean;
    };

interface JsonToken {
  readonly end: number;
  readonly valid: boolean;
}

const JSON_NUMBER = /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?$/u;
const JSON_LITERAL = /^(?:false|null|true)$/u;

const consumeJsonValue = (
  container: JsonContainer | undefined,
  valid: boolean,
): void => {
  if (container === undefined) return;

  const expectsValue =
    container.kind === "object"
      ? container.state === "value"
      : container.state === "first-value-or-end" || container.state === "value";

  if (expectsValue) {
    container.state = "comma-or-end";
  } else {
    container.valid = false;
  }
  if (!valid) container.valid = false;
};

const consumeJsonString = (
  container: JsonContainer | undefined,
  start: number,
  valid: boolean,
): void => {
  if (
    container?.kind === "object" &&
    (container.state === "first-key-or-end" || container.state === "key")
  ) {
    container.node.keyStarts.push(start);
    container.state = "colon";
    if (!valid) container.valid = false;
    return;
  }

  consumeJsonValue(container, valid);
};

const scanJsonString = (meta: TextMeta, start: number): JsonToken => {
  let valid = true;

  for (let cursor = start + 1; cursor < meta.codePoints.length; cursor++) {
    const codePoint = meta.codePoints[cursor];
    if (codePoint === '"') return { end: cursor + 1, valid };

    if (codePoint === "\\") {
      const escape = meta.codePoints[++cursor];
      if (escape === "u") {
        const hex = meta.codePoints.slice(cursor + 1, cursor + 5).join("");
        if (!/^[0-9a-fA-F]{4}$/u.test(hex)) valid = false;
        cursor += 4;
      } else if (
        escape === undefined ||
        !['"', "\\", "/", "b", "f", "n", "r", "t"].includes(escape)
      ) {
        valid = false;
      }
      continue;
    }

    if ((codePoint.codePointAt(0) ?? 0) < 0x20) valid = false;
  }

  return { end: meta.codePoints.length, valid: false };
};

const isJsonTokenBoundary = (codePoint: string | undefined): boolean =>
  codePoint === undefined ||
  JSON_WHITESPACE.has(codePoint) ||
  ['"', ",", ":", "[", "]", "{", "}"].includes(codePoint);

const scanJsonPrimitive = (meta: TextMeta, start: number): JsonToken => {
  let end = start + 1;
  while (!isJsonTokenBoundary(meta.codePoints[end])) end++;

  const token = meta.codePoints.slice(start, end).join("");
  return {
    end,
    valid: JSON_LITERAL.test(token) || JSON_NUMBER.test(token),
  };
};

const closeJsonContainer = (
  containers: JsonContainer[],
  objectStack: JsonObjectNode[],
  expectedKind: JsonContainer["kind"],
  end: number,
): void => {
  while (
    containers.length > 0 &&
    containers[containers.length - 1]?.kind !== expectedKind
  ) {
    const incomplete = containers.pop();
    if (incomplete?.kind === "object") objectStack.pop();
    consumeJsonValue(containers[containers.length - 1], false);
  }

  const container = containers.pop();
  if (container === undefined) return;

  let valid: boolean;
  if (container.kind === "object") {
    objectStack.pop();
    valid =
      container.valid &&
      (container.state === "first-key-or-end" ||
        container.state === "comma-or-end");
    container.node.end = end;
    container.node.syntaxValid = valid;
  } else {
    valid =
      container.valid &&
      (container.state === "first-value-or-end" ||
        container.state === "comma-or-end");
  }

  consumeJsonValue(containers[containers.length - 1], valid);
};

const scanJsonObjectSyntax = (
  meta: TextMeta,
  start = 0,
  stopAfterRoot = false,
): readonly JsonObjectNode[] => {
  const containers: JsonContainer[] = [];
  const objectStack: JsonObjectNode[] = [];
  const objects: JsonObjectNode[] = [];

  for (let cursor = start; cursor < meta.codePoints.length; ) {
    const codePoint = meta.codePoints[cursor];
    if (containers.length === 0 && codePoint !== "{") {
      cursor++;
      continue;
    }

    const container = containers[containers.length - 1];
    if (JSON_WHITESPACE.has(codePoint)) {
      cursor++;
    } else if (codePoint === '"') {
      const token = scanJsonString(meta, cursor);
      consumeJsonString(container, cursor, token.valid);
      cursor = token.end;
    } else if (codePoint === "{") {
      const parent = objectStack[objectStack.length - 1] ?? null;
      const node: JsonObjectNode = {
        children: [],
        end: null,
        keyStarts: [],
        parent,
        start: cursor,
        syntaxValid: false,
      };
      parent?.children.push(node);
      objects.push(node);
      objectStack.push(node);
      containers.push({
        kind: "object",
        node,
        state: "first-key-or-end",
        valid: true,
      });
      cursor++;
    } else if (codePoint === "[") {
      containers.push({
        kind: "array",
        state: "first-value-or-end",
        valid: true,
      });
      cursor++;
    } else if (codePoint === "}" || codePoint === "]") {
      closeJsonContainer(
        containers,
        objectStack,
        codePoint === "}" ? "object" : "array",
        cursor + 1,
      );
      cursor++;
      if (stopAfterRoot && objects.length > 0 && containers.length === 0) break;
    } else if (codePoint === ":") {
      if (container?.kind === "object" && container.state === "colon") {
        container.state = "value";
      } else if (container !== undefined) {
        container.valid = false;
      }
      cursor++;
    } else if (codePoint === ",") {
      if (container?.state === "comma-or-end") {
        container.state = container.kind === "object" ? "key" : "value";
      } else if (container !== undefined) {
        container.valid = false;
      }
      cursor++;
    } else {
      const token = scanJsonPrimitive(meta, cursor);
      consumeJsonValue(container, token.valid);
      cursor = token.end;
    }
  }

  return objects;
};

const cacheValidJsonObjectTree = (
  root: JsonObjectNode,
  cache: Map<number, JsonMetadataObjectValidation | null>,
): void => {
  const pending = [root];
  while (pending.length > 0) {
    const node = pending.pop();
    if (node === undefined || node.end === null) continue;
    for (const keyStart of node.keyStarts) {
      cache.set(keyStart, { end: node.end });
    }
    pending.push(...node.children);
  }
};

const cacheUnvalidatedJsonObjectKeys = (
  objects: readonly JsonObjectNode[],
  cache: Map<number, JsonMetadataObjectValidation | null>,
): void => {
  for (const object of objects) {
    for (const keyStart of object.keyStarts) {
      if (!cache.has(keyStart)) cache.set(keyStart, null);
    }
  }
};

const nextJsonContent = (
  meta: TextMeta,
  start: number,
  end: number,
): number => {
  let cursor = start;
  while (cursor < end && JSON_WHITESPACE.has(meta.codePoints[cursor])) cursor++;
  return cursor;
};

const isPotentialJsonObjectStart = (
  meta: TextMeta,
  start: number,
  end: number,
): boolean => {
  const keyStart = nextJsonContent(meta, start + 1, end);
  if (meta.codePoints[keyStart] === "}") return true;
  if (meta.codePoints[keyStart] !== '"') return false;

  const key = scanJsonString(meta, keyStart);
  return (
    key.valid && meta.codePoints[nextJsonContent(meta, key.end, end)] === ":"
  );
};

const isPotentialJsonObjectEnd = (
  meta: TextMeta,
  position: number,
  end: number,
): boolean => {
  const next = nextJsonContent(meta, position + 1, end);
  return (
    next === end ||
    meta.codePoints[next] === "," ||
    meta.codePoints[next] === "]" ||
    meta.codePoints[next] === "}"
  );
};

const cacheLexicalJsonMetadataKeys = (
  meta: TextMeta,
  start: number,
  end: number,
  cache: Map<number, JsonMetadataObjectValidation | null>,
): void => {
  let objectDepth = 0;

  for (let cursor = start; cursor < end; cursor++) {
    if (
      meta.codePoints[cursor] === "{" &&
      (cursor === start || isPotentialJsonObjectStart(meta, cursor, end))
    ) {
      objectDepth++;
      continue;
    }
    if (
      meta.codePoints[cursor] === "}" &&
      objectDepth > 1 &&
      isPotentialJsonObjectEnd(meta, cursor, end)
    ) {
      objectDepth--;
      continue;
    }
    if (meta.codePoints[cursor] !== '"' || isEscapedJsonQuote(meta, cursor)) {
      continue;
    }

    const token = scanJsonString(meta, cursor);
    const closingQuote = token.end - 1;
    if (
      token.end > end ||
      meta.codePoints[closingQuote] !== '"' ||
      decodeJsonMetadataKey(meta, cursor, closingQuote) === null
    ) {
      continue;
    }

    let next = token.end;
    while (next < end && JSON_WHITESPACE.has(meta.codePoints[next])) next++;
    if (
      objectDepth === 1 &&
      meta.codePoints[next] === ":" &&
      !cache.has(cursor)
    ) {
      cache.set(cursor, null);
    }
  }
};

const recoverUnindexedJsonMetadataObject = (
  meta: TextMeta,
  metadata: JsonNumericMetadata,
  cache: Map<number, JsonMetadataObjectValidation | null>,
): void => {
  const objectStart = jsonObjectStartBefore(meta, metadata.keyStart);
  if (objectStart === null) return;

  const objects = scanJsonObjectSyntax(meta, objectStart, true);
  const [root] = objects;
  const recoveryEnd = root?.end ?? meta.codePoints.length;
  cacheUnvalidatedJsonObjectKeys(objects, cache);
  cacheLexicalJsonMetadataKeys(meta, objectStart, recoveryEnd, cache);
  if (!cache.has(metadata.keyStart)) cache.set(metadata.keyStart, null);

  if (root?.start !== objectStart || !root.syntaxValid || root.end === null) {
    return;
  }

  try {
    const parsed: unknown = JSON.parse(
      meta.codePoints.slice(root.start, root.end).join(""),
    );
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      !Array.isArray(parsed)
    ) {
      cacheValidJsonObjectTree(root, cache);
    }
  } catch {
    // JSON.parse remains authoritative for recovered object roots.
  }
};

const indexJsonMetadataObjects = (
  meta: TextMeta,
  cache: Map<number, JsonMetadataObjectValidation | null>,
): void => {
  const objects = scanJsonObjectSyntax(meta);
  cacheUnvalidatedJsonObjectKeys(objects, cache);

  for (const object of objects) {
    if (
      !object.syntaxValid ||
      object.end === null ||
      object.parent?.syntaxValid === true
    ) {
      continue;
    }

    try {
      const parsed: unknown = JSON.parse(
        meta.codePoints.slice(object.start, object.end).join(""),
      );
      if (
        typeof parsed === "object" &&
        parsed !== null &&
        !Array.isArray(parsed)
      ) {
        cacheValidJsonObjectTree(object, cache);
      }
    } catch {
      // Syntax indexing is conservative; JSON.parse remains authoritative.
    }
  }
};

export const hasCompleteJsonMetadataObject = (
  meta: TextMeta,
  metadata: JsonNumericMetadata,
  valueEnd: number,
): boolean => {
  let cache = JSON_METADATA_OBJECT_CACHE.get(meta);
  if (cache === undefined) {
    cache = new Map();
    JSON_METADATA_OBJECT_CACHE.set(meta, cache);
    indexJsonMetadataObjects(meta, cache);
  }

  let validation = cache.get(metadata.keyStart);
  if (validation === undefined) {
    recoverUnindexedJsonMetadataObject(meta, metadata, cache);
    validation = cache.get(metadata.keyStart);
  }
  return (
    validation !== null && validation !== undefined && validation.end > valueEnd
  );
};

export const sourceSpanEquals = (
  meta: TextMeta,
  start: number,
  end: number,
  expected: string,
): boolean => {
  const expectedCodePoints = Array.from(expected);
  if (end - start !== expectedCodePoints.length) return false;

  return expectedCodePoints.every(
    (codePoint, offset) => meta.codePoints[start + offset] === codePoint,
  );
};

export const hasExactJsonMetadataValueEnd = (
  meta: TextMeta,
  end: number,
  quoted: boolean,
): boolean => {
  if (quoted) return meta.codePoints[end] === '"';

  let cursor = end;
  while (
    cursor < meta.codePoints.length &&
    JSON_WHITESPACE.has(meta.codePoints[cursor])
  ) {
    cursor++;
  }

  return meta.codePoints[cursor] === "," || meta.codePoints[cursor] === "}";
};
