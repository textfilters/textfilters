import type { ProfanityDictionary } from "./types.js";
import {
  applyAliases,
  createCompactView,
  createExactView,
  normalizeAliasSymbol,
  normalizeSource,
} from "./normalize.js";

const MAX_ENTRY_CHARACTERS = 128;
const DENY_ENTRY_RE = /^[\p{L}\p{N}]+(?: [\p{L}\p{N}]+)*$/u;

export interface CompiledDenyEntry {
  readonly term: string;
  readonly groups: readonly (readonly [value: string, minimumCount: number])[];
  readonly wordBoundaries: readonly CompiledWordBoundary[];
  readonly minimumLength: number;
}

export interface CompiledWordBoundary {
  readonly groupIndex: number;
  readonly minimumBefore: number;
  readonly minimumAfter: number;
}

export interface DenyTrieNode {
  readonly children: ReadonlyMap<string, DenyTrieNode>;
  readonly entries: readonly CompiledDenyEntry[];
}

export interface AllowTrieNode {
  readonly children: ReadonlyMap<string, AllowTrieNode>;
  readonly terms: readonly string[];
}

export interface CompiledDictionary {
  readonly id: string;
  readonly order: number;
  readonly aliases: ReadonlyMap<string, string>;
  readonly deny: DenyTrieNode;
  readonly allow: AllowTrieNode;
  readonly maxAllowLength: number;
}

interface AliasRecord {
  readonly from: string;
  readonly to: string;
  readonly raw: string;
}

interface CompiledAllowEntry {
  readonly term: string;
  readonly key: string;
  readonly values: readonly string[];
}

interface InternalDenyEntry extends CompiledDenyEntry {
  readonly exactKey: string;
  readonly groupKey: string;
}

interface MutableDenyTrieNode {
  readonly children: Map<string, MutableDenyTrieNode>;
  readonly entries: CompiledDenyEntry[];
}

interface MutableAllowTrieNode {
  readonly children: Map<string, MutableAllowTrieNode>;
  readonly terms: string[];
}

export function compileDictionaries(
  dictionaries: readonly ProfanityDictionary[],
): readonly CompiledDictionary[] {
  const ids = new Map<string, number>();

  return Object.freeze(
    dictionaries.map((dictionary, order) => {
      const compiled = compileDictionary(dictionary, order);
      const first = ids.get(compiled.id);
      if (first !== undefined) {
        throw new TypeError(
          `dictionary id conflict: "${compiled.id}" appears at indexes ${first} and ${order}`,
        );
      }
      ids.set(compiled.id, order);
      return compiled;
    }),
  );
}

function compileDictionary(
  dictionary: ProfanityDictionary,
  order: number,
): CompiledDictionary {
  if (typeof dictionary !== "object" || dictionary === null) {
    throw new TypeError(`dictionary at index ${order} must be an object`);
  }
  if (typeof dictionary.id !== "string" || dictionary.id.trim() === "") {
    throw new TypeError(`dictionary at index ${order} must have a string id`);
  }
  if (dictionary.id.trim() !== dictionary.id) {
    throw new TypeError(
      `dictionary id "${dictionary.id}" must not have surrounding whitespace`,
    );
  }
  if (!Array.isArray(dictionary.deny) || !Array.isArray(dictionary.allow)) {
    throw new TypeError(
      `dictionary "${dictionary.id}" must provide deny and allow arrays`,
    );
  }

  const aliases = compileAliases(dictionary.aliases ?? [], dictionary.id);
  const denyEntries = compileDenyEntries(
    dictionary.deny,
    aliases,
    dictionary.id,
  );
  const allowEntries = compileAllowEntries(
    dictionary.allow,
    aliases,
    dictionary.id,
  );
  rejectDenyAllowConflicts(denyEntries, allowEntries, dictionary.id);

  return Object.freeze({
    id: dictionary.id,
    order,
    aliases,
    deny: buildDenyTrie(denyEntries),
    allow: buildAllowTrie(allowEntries),
    maxAllowLength: allowEntries.reduce(
      (maximum, entry) => Math.max(maximum, entry.values.length),
      0,
    ),
  });
}

function compileAliases(
  aliases: readonly (readonly [string, string])[],
  dictionaryId: string,
): ReadonlyMap<string, string> {
  if (!Array.isArray(aliases)) {
    throw new TypeError(
      `dictionary "${dictionaryId}" aliases must be an array`,
    );
  }

  const records: AliasRecord[] = [];
  const bySource = new Map<string, AliasRecord>();

  for (const [index, pair] of aliases.entries()) {
    if (!Array.isArray(pair) || pair.length !== 2) {
      throw new TypeError(
        `dictionary "${dictionaryId}" aliases[${index}] must be a pair`,
      );
    }
    const [rawFrom, rawTo] = pair;
    if (typeof rawFrom !== "string" || typeof rawTo !== "string") {
      throw new TypeError(
        `dictionary "${dictionaryId}" aliases[${index}] must contain strings`,
      );
    }

    const raw = `${rawFrom}=${rawTo}`;
    const from = normalizeAliasSymbol(rawFrom);
    const to = normalizeAliasSymbol(rawTo);
    if (!from || !to) {
      throw new TypeError(
        `dictionary "${dictionaryId}" aliases entry "${raw}" must map one letter or number to one letter or number`,
      );
    }
    if (from === to) {
      throw new TypeError(
        `dictionary "${dictionaryId}" aliases entry "${raw}" maps "${from}" to itself`,
      );
    }

    const first = bySource.get(from);
    if (first) {
      throw aliasConflict(dictionaryId, first.raw, raw, "duplicate source");
    }

    const record = { from, to, raw };
    records.push(record);
    bySource.set(from, record);
  }

  for (const record of records) {
    const next = bySource.get(record.to);
    if (next) {
      throw aliasConflict(dictionaryId, record.raw, next.raw, "chain or cycle");
    }
  }

  return new Map(records.map(({ from, to }) => [from, to]));
}

function compileDenyEntries(
  values: readonly string[],
  aliases: ReadonlyMap<string, string>,
  dictionaryId: string,
): readonly InternalDenyEntry[] {
  const entries: InternalDenyEntry[] = [];
  const seen = new Map<string, string>();

  for (const [index, value] of values.entries()) {
    validateEntry(value, dictionaryId, "deny", index);
    if (!DENY_ENTRY_RE.test(value)) {
      throw new TypeError(
        `dictionary "${dictionaryId}" deny entry "${value}" must contain only Unicode letters, numbers, and single spaces between words`,
      );
    }
    const units = applyAliases(normalizeSource(value), aliases);
    const exactKey = createExactView(units).key;
    const compact = createCompactView(units);
    if (compact.characters.length === 0) {
      throw new TypeError(
        `dictionary "${dictionaryId}" deny entry "${value}" must contain a letter or number`,
      );
    }
    if (compact.characters.length > MAX_ENTRY_CHARACTERS) {
      throw new TypeError(
        `dictionary "${dictionaryId}" deny entry "${value}" exceeds ${MAX_ENTRY_CHARACTERS} compact characters`,
      );
    }

    const groups = compact.runs.map(
      ({ value: character, count }) => [character, count] as const,
    );
    const wordBoundaries = compileWordBoundaries(compact, groups);
    const groupKey = JSON.stringify({ groups, wordBoundaries });
    const first = seen.get(groupKey);
    if (first !== undefined) {
      throw entryConflict(
        dictionaryId,
        "deny",
        first,
        value,
        "normalize to the same run-aware key",
      );
    }
    seen.set(groupKey, value);
    entries.push({
      term: value,
      exactKey,
      groupKey,
      groups,
      wordBoundaries,
      minimumLength: compact.characters.length,
    });
  }

  return entries;
}

function compileWordBoundaries(
  compact: ReturnType<typeof createCompactView>,
  groups: readonly (readonly [value: string, minimumCount: number])[],
): readonly CompiledWordBoundary[] {
  const boundaries: CompiledWordBoundary[] = [];

  for (const [characterIndex, character] of compact.characters.entries()) {
    if (characterIndex === 0 || !character.hasWhitespaceBefore) continue;

    let groupStart = 0;
    for (const [groupIndex, [, minimumCount]] of groups.entries()) {
      const groupEnd = groupStart + minimumCount;
      if (characterIndex <= groupEnd) {
        boundaries.push({
          groupIndex,
          minimumBefore: characterIndex - groupStart,
          minimumAfter: groupEnd - characterIndex,
        });
        break;
      }
      groupStart = groupEnd;
    }
  }

  return boundaries;
}

function compileAllowEntries(
  values: readonly string[],
  aliases: ReadonlyMap<string, string>,
  dictionaryId: string,
): readonly CompiledAllowEntry[] {
  const entries: CompiledAllowEntry[] = [];
  const seen = new Map<string, string>();

  for (const [index, value] of values.entries()) {
    validateEntry(value, dictionaryId, "allow", index);
    const exact = createExactView(
      applyAliases(normalizeSource(value), aliases),
    );
    if (exact.key === "" || exact.units.every(({ value }) => value === " ")) {
      throw new TypeError(
        `dictionary "${dictionaryId}" allow entry "${value}" must not normalize to empty text`,
      );
    }
    if (exact.units.length > MAX_ENTRY_CHARACTERS) {
      throw new TypeError(
        `dictionary "${dictionaryId}" allow entry "${value}" exceeds ${MAX_ENTRY_CHARACTERS} normalized characters`,
      );
    }

    const first = seen.get(exact.key);
    if (first !== undefined) {
      throw entryConflict(
        dictionaryId,
        "allow",
        first,
        value,
        "normalize to the same exact key",
      );
    }
    seen.set(exact.key, value);
    entries.push({
      term: value,
      key: exact.key,
      values: exact.units.map(({ value: character }) => character),
    });
  }

  return entries;
}

function rejectDenyAllowConflicts(
  denyEntries: readonly InternalDenyEntry[],
  allowEntries: readonly CompiledAllowEntry[],
  dictionaryId: string,
): void {
  const denyByExactKey = new Map(
    denyEntries.map((entry) => [entry.exactKey, entry.term]),
  );

  for (const allow of allowEntries) {
    const deny = denyByExactKey.get(allow.key);
    if (deny !== undefined) {
      throw new TypeError(
        `dictionary "${dictionaryId}" deny/allow conflict: deny "${deny}" and allow "${allow.term}" normalize to the same exact key`,
      );
    }
  }
}

function buildDenyTrie(entries: readonly CompiledDenyEntry[]): DenyTrieNode {
  const root: MutableDenyTrieNode = { children: new Map(), entries: [] };

  for (const entry of entries) {
    let node = root;
    for (const [value] of entry.groups) {
      let child = node.children.get(value);
      if (!child) {
        child = { children: new Map(), entries: [] };
        node.children.set(value, child);
      }
      node = child;
    }
    node.entries.push(entry);
    node.entries.sort(
      (left, right) =>
        right.minimumLength - left.minimumLength ||
        compareStrings(left.term, right.term),
    );
  }

  return root;
}

function buildAllowTrie(entries: readonly CompiledAllowEntry[]): AllowTrieNode {
  const root: MutableAllowTrieNode = { children: new Map(), terms: [] };

  for (const entry of entries) {
    let node = root;
    for (const value of entry.values) {
      let child = node.children.get(value);
      if (!child) {
        child = { children: new Map(), terms: [] };
        node.children.set(value, child);
      }
      node = child;
    }
    node.terms.push(entry.term);
  }

  return root;
}

function validateEntry(
  value: unknown,
  dictionaryId: string,
  side: "deny" | "allow",
  index: number,
): asserts value is string {
  if (typeof value !== "string") {
    throw new TypeError(
      `dictionary "${dictionaryId}" ${side}[${index}] must be a string`,
    );
  }
  if (value === "" || value.trim() === "") {
    throw new TypeError(
      `dictionary "${dictionaryId}" ${side}[${index}] must not be empty`,
    );
  }
  if (value.trim() !== value) {
    throw new TypeError(
      `dictionary "${dictionaryId}" ${side} entry "${value}" must not have surrounding whitespace`,
    );
  }
}

function aliasConflict(
  dictionaryId: string,
  first: string,
  second: string,
  reason: string,
): TypeError {
  return new TypeError(
    `dictionary "${dictionaryId}" aliases conflict (${reason}): "${first}" and "${second}"`,
  );
}

function entryConflict(
  dictionaryId: string,
  side: "deny" | "allow",
  first: string,
  second: string,
  reason: string,
): TypeError {
  return new TypeError(
    `dictionary "${dictionaryId}" ${side} conflict: "${first}" and "${second}" ${reason}`,
  );
}

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
