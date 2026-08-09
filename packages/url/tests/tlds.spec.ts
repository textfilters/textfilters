import { describe, expect, it } from "vitest";

import {
  IANA_ASCII_TLDS,
  IANA_TLD_SNAPSHOT_VERSION,
  IANA_TLDS,
  IANA_UNICODE_TLDS,
} from "../src/tld-data.js";

describe("IANA TLD snapshot", () => {
  it("keeps a versioned, unique, sorted registry snapshot", () => {
    expect(IANA_TLD_SNAPSHOT_VERSION).toBe("2026080801");
    expect(IANA_ASCII_TLDS).toHaveLength(1_438);
    expect(IANA_UNICODE_TLDS).toHaveLength(151);
    expect(new Set(IANA_TLDS).size).toBe(IANA_TLDS.length);
    expect(IANA_ASCII_TLDS).toEqual([...IANA_ASCII_TLDS].sort());
    expect(IANA_UNICODE_TLDS).toEqual([...IANA_UNICODE_TLDS].sort());
    expect(IANA_ASCII_TLDS).toEqual(
      expect.arrayContaining(["be", "travel", "xn--h2brj9c"]),
    );
    expect(IANA_UNICODE_TLDS).toEqual(
      expect.arrayContaining(["भारत", "বাংলা", "한국"]),
    );
    expect(IANA_TLDS).toEqual([...IANA_ASCII_TLDS, ...IANA_UNICODE_TLDS]);
    expect(IANA_ASCII_TLDS.every((tld) => /^[a-z0-9-]+$/u.test(tld))).toBe(
      true,
    );
    expect(
      IANA_UNICODE_TLDS.every(
        (tld) => tld.normalize("NFC") === tld && /[^\x00-\x7f]/u.test(tld),
      ),
    ).toBe(true);
  });
});
