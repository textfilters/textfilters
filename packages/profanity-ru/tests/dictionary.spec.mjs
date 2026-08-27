import { describe, expect, it } from "vitest";

import dictionary, { dictionary as namedDictionary } from "../dist/index.js";

describe("Russian profanity dictionary", () => {
  it("exports the structural dictionary contract", () => {
    expect(dictionary).toBe(namedDictionary);
    expect(dictionary).toEqual({
      id: "ru",
      deny: expect.any(Array),
      allow: expect.any(Array),
      aliases: expect.any(Array),
    });
    expect(dictionary.deny.length).toBeGreaterThan(0);
    expect(dictionary.allow.length).toBeGreaterThan(0);
    expect(dictionary.aliases.length).toBeGreaterThan(0);
  });
});
