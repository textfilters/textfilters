import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";

const MAX_LITERAL_LENGTH = 512;

export function createDuplicateKey(normalized: string): string {
  if (normalized.length <= MAX_LITERAL_LENGTH) return `text:${normalized}`;

  const hash = sha256.create();
  const bytes = new Uint8Array(1_024);
  // Encode exact UTF-16 code units as little-endian bytes. UTF-8 would collapse
  // distinct unpaired surrogates to the same replacement character.
  for (let start = 0; start < normalized.length; start += bytes.length / 2) {
    const count = Math.min(bytes.length / 2, normalized.length - start);
    for (let index = 0; index < count; index++) {
      const code = normalized.charCodeAt(start + index);
      bytes[index * 2] = code & 0xff;
      bytes[index * 2 + 1] = code >>> 8;
    }
    hash.update(bytes.subarray(0, count * 2));
  }
  return `sha256:${bytesToHex(hash.digest())}`;
}
