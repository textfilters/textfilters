import { describe, expect, it } from "vitest";

import { filter } from "../src/index.js";

describe("false positives", () => {
  it("keeps current false-positive locks untouched", () => {
    const neutral = [
      "blender",
      "bleyanie",
      "блеяние",
      "блян",
      "удалять",
      "хулиган",
      "хулиганы",
      "хулиганство",
      "Хулио",
      "хулит",
      "х у л и г а н",
      "х у л и о",
      "нахер",
      "страхуеть",
      "ахуетька",
      "ахуетье",
      "похерил",
      "тикитоке батов",
      "небанальный",
      "небанально",
      "Ебург",
      "Екатеринбург",
      "ебург как сокращение",
      "хлеб",
      "лебедь",
      "пиксебатл",
      "съесть",
      "съемка",
      "вьетнам",
      "отъезд",
      "план",
      "бланк",
      "долбить",
    ];

    for (const input of neutral) {
      expect(filter.censor(input)).toBe(input);
    }
  });
});
