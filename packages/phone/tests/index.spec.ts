import { describe, expect, it } from "vitest";

import { filter } from "../src/index.js";

const mask = (s: string, ch = "*") => ch.repeat(Array.from(s).length);
const maskLength = (s: string, ch = "*") => ch.repeat(s.length);

describe("textfilters phone package", () => {
  it("exposes the final shared filter", () => {
    expect(filter.name).toBe("phone");
  });

  it("exposes the shared text filter methods with UTF-16 ranges", () => {
    const text = "😀 +1 202 555 0187";
    const [match] = filter.find(text);

    expect(filter.check(text)).toBe(true);
    expect(match).toEqual({
      start: 3,
      end: 18,
      value: "+1 202 555 0187",
      filter: "phone",
    });
    expect(filter.process(text)).toEqual({
      censored: `😀 ${"*".repeat(15)}`,
      matches: [match],
    });
  });

  it("accepts empty text and rejects non-string TextFilter input", () => {
    expect(filter.censor("")).toBe("");
    const unsafe = filter as unknown as { censor(value: unknown): string };
    expect(() => unsafe.censor(null)).toThrow("text must be a string");
  });

  it("censors common RU and international phone formats", () => {
    expect(filter.censor("+7 (999) 123-45-67")).toBe(
      mask("+7 (999) 123-45-67"),
    );
    expect(filter.censor("8 999 123 45 67")).toBe(mask("8 999 123 45 67"));
    expect(filter.censor("79991234567")).toBe(mask("79991234567"));
    expect(filter.censor("+1 202 555 0187")).toBe(mask("+1 202 555 0187"));
    expect(filter.censor("+33 1 23 45 67 89")).toBe(mask("+33 1 23 45 67 89"));
    expect(filter.censor("+33 (0) 1 23 45 67 89")).toBe(
      mask("+33 (0) 1 23 45 67 89"),
    );
    expect(filter.censor("(+7) 999 123 45 67")).toBe(
      mask("(+7) 999 123 45 67"),
    );
    expect(filter.censor("( +7) 999 123 45 67")).toBe(
      mask("( +7) 999 123 45 67"),
    );
    expect(filter.censor("(79991234567)")).toBe(mask("(79991234567)"));
    expect(filter.censor("(+7 999 123 45 67)")).toBe(
      mask("(+7 999 123 45 67)"),
    );
    expect(filter.censor("tel(+7) 999 123 45 67")).toBe(
      `tel${mask("(+7) 999 123 45 67")}`,
    );
    expect(filter.censor("phone(79991234567)")).toBe(
      `phone${mask("(79991234567)")}`,
    );
    expect(filter.censor("℡79991234567")).toBe(`℡${mask("79991234567")}`);
    expect(filter.censor("☎79991234567")).toBe(`☎${mask("79991234567")}`);
    expect(filter.censor("☎️79991234567")).toBe(`☎️${mask("79991234567")}`);
  });

  it("censors numbers inside surrounding text", () => {
    const input = "пиши на +7 (999) 123-45-67 сегодня";
    expect(filter.censor(input)).toBe(
      `пиши на ${mask("+7 (999) 123-45-67")} сегодня`,
    );
  });

  it("handles separators, zero-width and unicode normalization cases", () => {
    expect(filter.censor("+7-999-123-45-67")).toBe(mask("+7-999-123-45-67"));
    expect(filter.censor("+7.999.123.45.67")).toBe(mask("+7.999.123.45.67"));
    expect(filter.censor("+7 999 1 2 3 4 5 6 7")).toBe(
      mask("+7 999 1 2 3 4 5 6 7"),
    );

    const input = "+7\u200B999\u200B123\u200B45\u200B67";
    expect(filter.censor(input)).toBe(mask(input));
    expect(filter.censor("call １２３４５６７８９０ now")).toBe(
      `call ${mask("１２３４５６７８９０")} now`,
    );
    expect(filter.censor("call ٧٩٩٩١٢٣٤٥٦٧ now")).toBe(
      `call ${mask("٧٩٩٩١٢٣٤٥٦٧")} now`,
    );
    expect(filter.censor("call 𐒧𐒩𐒩𐒩𐒡𐒢𐒣𐒤𐒥𐒦𐒧 now")).toBe(
      `call ${maskLength("𐒧𐒩𐒩𐒩𐒡𐒢𐒣𐒤𐒥𐒦𐒧")} now`,
    );
    expect(filter.censor("call 𑽗𑽙𑽙𑽙𑽑𑽒𑽓𑽔𑽕𑽖𑽗 now")).toBe(
      `call ${maskLength("𑽗𑽙𑽙𑽙𑽑𑽒𑽓𑽔𑽕𑽖𑽗")} now`,
    );
    expect(filter.censor("call 𑛡𑛣𑛣𑛣𑛛𑛜𑛝𑛞𑛟𑛠𑛡 now")).toBe(
      `call ${maskLength("𑛡𑛣𑛣𑛣𑛛𑛜𑛝𑛞𑛟𑛠𑛡")} now`,
    );
  });

  it("keeps current digit boundary and length behavior", () => {
    expect(filter.censor("abc79991234567def")).toBe("abc79991234567def");
    expect(filter.censor("abc\u200B79991234567\u200Bdef")).toBe(
      "abc\u200B79991234567\u200Bdef",
    );
    expect(filter.censor("abc+79991234567 xyz79991234567")).toBe(
      "abc+79991234567 xyz79991234567",
    );
    expect(filter.censor("tel+79991234567")).toBe(`tel${mask("+79991234567")}`);
    expect(filter.censor("value.79991234567")).toBe("value.79991234567");
    expect(filter.censor("user_79991234567")).toBe("user_79991234567");
    expect(filter.censor("coords 55.\u200B7558 37.6173")).toBe(
      "coords 55.\u200B7558 37.6173",
    );
    expect(filter.censor("word1234567890")).toBe("word1234567890");
    expect(filter.censor("7999123456")).toBe(mask("7999123456"));
    expect(filter.censor("123456789012345")).toBe(mask("123456789012345"));
    expect(filter.censor("1234567890123456")).toBe("1234567890123456");
  });

  it("treats serialized machine payloads as ordinary text", () => {
    const serialized =
      '{"serverTs":1784477618588,"message":"+7 999 123 45 67"}';
    const values = filter.find(serialized).map((match) => match.value);

    expect(values).toContain("1784477618588");
    expect(filter.check("prefix 1784477618588 suffix")).toBe(true);

    const parsed = JSON.parse(serialized) as { message: string };
    expect(filter.censor(parsed.message)).toBe(mask(parsed.message));
  });

  it("keeps current grouped-number false positive boundaries", () => {
    expect(filter.censor("12 34 56 78 90 12 34")).toBe("12 34 56 78 90 12 34");
    expect(filter.censor("1234 7890 1234 56")).toBe("1234 7890 1234 56");
    expect(
      filter.censor(
        "date 2026-03-22 coordinates 55.7558, 37.6173 word1234567890",
      ),
    ).toBe("date 2026-03-22 coordinates 55.7558, 37.6173 word1234567890");
    expect(filter.censor("coords 55.7558 100.1234")).toBe(
      "coords 55.7558 100.1234",
    );
    expect(filter.censor("coords 55.7558 37.6173 100")).toBe(
      "coords 55.7558 37.6173 100",
    );
    expect(filter.censor("coords 55,7558 37,6173")).toBe(
      "coords 55,7558 37,6173",
    );
    expect(filter.censor("coords 5.1234 37.6173")).toBe(
      "coords 5.1234 37.6173",
    );
    expect(filter.censor("coords 55.755 37.617")).toBe("coords 55.755 37.617");
    expect(filter.censor("coords 55.7558, 37.6173 7999")).toBe(
      "coords 55.7558, 37.6173 7999",
    );
    expect(filter.censor("coords 79.9912 345.6789")).toBe(
      `coords ${mask("79.9912 345.6789")}`,
    );
    expect(filter.censor("date 30.05.1999 12.30")).toBe(
      "date 30.05.1999 12.30",
    );
    expect(filter.censor("date 79.99.2020 1234")).toBe(
      `date ${mask("79.99.2020 1234")}`,
    );
    expect(filter.censor("coords 55.7558 100.1234 7999")).toBe(
      "coords 55.7558 100.1234 7999",
    );
    expect(filter.censor("(30.05.2026 12.30)")).toBe("(30.05.2026 12.30)");
    expect(filter.censor("server 10.100.100.100")).toBe(
      "server 10.100.100.100",
    );
    expect(filter.censor("balance 1,234,567,890")).toBe(
      "balance 1,234,567,890",
    );
    expect(filter.censor("balance 1.234.567.890")).toBe(
      "balance 1.234.567.890",
    );
    expect(filter.censor("balance 1 234 567 890")).toBe(
      "balance 1 234 567 890",
    );
    expect(filter.censor("amount 12,345,678.90")).toBe("amount 12,345,678.90");
    expect(filter.censor("amount 12.345.678,90")).toBe("amount 12.345.678,90");
    expect(filter.censor("ISBN 9781402894626")).toBe("ISBN 9781402894626");
    expect(filter.censor("server 10.100.100.100 123 456 7890")).toBe(
      `server 10.100.100.100 ${mask("123 456 7890")}`,
    );
    expect(filter.censor("abc1234 7890 1234 56")).toBe("abc1234 7890 1234 56");
    expect(filter.censor("cafe\u030179991234567")).toBe(
      "cafe\u030179991234567",
    );
  });

  it("keeps current group validation behavior", () => {
    expect(filter.censor("1234 123 456")).toBe("1234 123 456");
    expect(filter.censor("7999 123 456")).toBe(mask("7999 123 456"));
    expect(filter.censor("8999 123 456")).toBe(mask("8999 123 456"));
    expect(filter.censor("+1234 123 456")).toBe(mask("+1234 123 456"));
    expect(filter.censor("(1234) 123 456")).toBe(mask("(1234) 123 456"));
    expect(filter.censor("(1234 123 456 )")).toBe(mask("(1234 123 456 )"));
    expect(filter.censor("0044 20 7946 0958")).toBe(mask("0044 20 7946 0958"));
    expect(filter.censor("ref (1234 123 456")).toBe("ref (1234 123 456");
    expect(filter.censor("ref 1234) 123 456")).toBe("ref 1234) 123 456");
    expect(filter.censor("1234 123 456 (")).toBe("1234 123 456 (");
    expect(filter.censor("7 123 123 123")).toBe(mask("7 123 123 123"));
    expect(filter.censor("7-123-123-123")).toBe(mask("7-123-123-123"));
    expect(filter.censor("call 7.999.123.456")).toBe(
      `call ${mask("7.999.123.456")}`,
    );
    expect(filter.censor("call 8.999.123.456")).toBe(
      `call ${mask("8.999.123.456")}`,
    );
    expect(filter.censor("7999-12-34-56")).toBe(mask("7999-12-34-56"));
    expect(filter.censor("+7/999/123/45/67")).toBe(mask("+7/999/123/45/67"));
  });

  it("censors valid phones followed by unrelated grouped numbers", () => {
    expect(filter.censor("79991234567 123456")).toBe(
      `${mask("79991234567")} 123456`,
    );
    expect(filter.censor("2026-03-22 7999 123 456")).toBe(
      `2026-03-22 ${mask("7999 123 456")}`,
    );
    expect(filter.censor("2026/03/22 7999 123 456")).toBe(
      `2026/03/22 ${mask("7999 123 456")}`,
    );
    expect(filter.censor("05/30/2026 202 555 0187")).toBe(
      `05/30/2026 ${mask("202 555 0187")}`,
    );
    expect(filter.censor("05-30-2026 202 555 0187")).toBe(
      `05-30-2026 ${mask("202 555 0187")}`,
    );
    expect(filter.censor("Meeting 12:30 7999 123 456")).toBe(
      `Meeting 12:30 ${mask("7999 123 456")}`,
    );
    expect(filter.censor("Meeting 12.30 7999 123 456")).toBe(
      `Meeting 12.30 ${mask("7999 123 456")}`,
    );
    expect(filter.censor("Meeting 12:30:45 7999 123 456")).toBe(
      `Meeting 12:30:45 ${mask("7999 123 456")}`,
    );
    expect(filter.censor("Meeting 12:30:45.123 7999 123 456")).toBe(
      `Meeting 12:30:45.123 ${mask("7999 123 456")}`,
    );
    expect(filter.censor("Meeting 12.30.45 7999 123 456")).toBe(
      `Meeting 12.30.45 ${mask("7999 123 456")}`,
    );
    expect(filter.censor("Meeting 12:30+0300 7999 123 456")).toBe(
      `Meeting 12:30+0300 ${mask("7999 123 456")}`,
    );
    expect(filter.censor("30.05.1999 12:30+0300 7999 123 456")).toBe(
      `30.05.1999 12:30+0300 ${mask("7999 123 456")}`,
    );
    expect(filter.censor("Meeting 12:3\u200b0 7999 123 456")).toBe(
      `Meeting 12:3\u200b0 ${mask("7999 123 456")}`,
    );
    expect(filter.censor("Meeting 1:23 7999 123 456")).toBe(
      `Meeting 1:23 ${mask("7999 123 456")}`,
    );
    expect(filter.censor("price 55.75 7999 123 456")).toBe(
      `price 55.75 ${mask("7999 123 456")}`,
    );
    expect(filter.censor("price 55,75 7999 123 456")).toBe(
      `price 55,75 ${mask("7999 123 456")}`,
    );
    expect(filter.censor("price 55.75 202 555 0187")).toBe(
      `price 55.75 ${mask("202 555 0187")}`,
    );
    expect(filter.censor("price 1,234.56 7999 123 456")).toBe(
      `price 1,234.56 ${mask("7999 123 456")}`,
    );
    expect(filter.censor("price 1.234,56 7999 123 456")).toBe(
      `price 1.234,56 ${mask("7999 123 456")}`,
    );
    expect(filter.censor("ratio ½ 7999 123 456")).toBe(
      `ratio ½ ${mask("7999 123 456")}`,
    );
    expect(filter.censor("server 10.0.0.1:443 7999 123 456")).toBe(
      `server 10.0.0.1:443 ${mask("7999 123 456")}`,
    );
    expect(filter.censor("network 10.0.0.0/24 7999 123 456")).toBe(
      `network 10.0.0.0/24 ${mask("7999 123 456")}`,
    );
    expect(filter.censor("ip 1.2.3.4 79991234567")).toBe(
      `ip 1.2.3.4 ${mask("79991234567")}`,
    );
    expect(filter.censor("ipv6 2001:db8::1 7999 123 456")).toBe(
      `ipv6 2001:db8::1 ${mask("7999 123 456")}`,
    );
    expect(filter.censor("ipv6 2001:db8::79991234567")).toBe(
      `ipv6 2001:db8::${mask("79991234567")}`,
    );
    expect(filter.censor("server 10.0.0.1:79991234567")).toBe(
      `server 10.0.0.1:${mask("79991234567")}`,
    );
    expect(filter.censor("phone:79991234567")).toBe(
      `phone:${mask("79991234567")}`,
    );
    expect(filter.censor("tel.79991234567")).toBe(`tel.${mask("79991234567")}`);
    expect(filter.censor("phone.79991234567")).toBe(
      `phone.${mask("79991234567")}`,
    );
    expect(filter.censor("ref 1234 79991234567")).toBe(
      `ref 1234 ${mask("79991234567")}`,
    );
    expect(filter.censor("ref 1234 202 555 0187")).toBe(
      `ref 1234 ${mask("202 555 0187")}`,
    );
    expect(filter.censor("abc123 79991234567")).toBe(
      `abc123 ${mask("79991234567")}`,
    );
    expect(filter.censor("abc123 202 555 0187")).toBe(
      `abc123 ${mask("202 555 0187")}`,
    );
    expect(filter.censor("call 79991234567\u0301 now")).toBe(
      `call ${mask("79991234567\u0301")} now`,
    );
    expect(filter.censor("call 79991234567x123")).toBe(
      `call ${mask("79991234567")}x123`,
    );
    expect(filter.censor("call 79991234567x.123")).toBe(
      `call ${mask("79991234567")}x.123`,
    );
    expect(filter.censor("call 79991234567ext123")).toBe(
      `call ${mask("79991234567")}ext123`,
    );
    expect(filter.censor("call 79991234567ext.123")).toBe(
      `call ${mask("79991234567")}ext.123`,
    );
    expect(filter.censor("call +1 202 555 0187x123")).toBe(
      `call ${mask("+1 202 555 0187")}x123`,
    );
    expect(filter.censor("tel 01 23 45 67 89")).toBe(
      `tel ${mask("01 23 45 67 89")}`,
    );
    expect(filter.censor("phone 33 1 23 45 67 89")).toBe(
      `phone ${mask("33 1 23 45 67 89")}`,
    );
    expect(filter.censor("coords 55.7558, 37.6173 7999 123 456")).toBe(
      `coords 55.7558, 37.6173 ${mask("7999 123 456")}`,
    );
    expect(filter.censor("coords 55.7558, +37.6173 7999 123 456")).toBe(
      `coords 55.7558, +37.6173 ${mask("7999 123 456")}`,
    );
    expect(filter.censor("coords 55.7558, -37.6173 7999 123 456")).toBe(
      `coords 55.7558, -37.6173 ${mask("7999 123 456")}`,
    );
    expect(filter.censor("coords 55,7558, +37,6173 7999 123 456")).toBe(
      `coords 55,7558, +37,6173 ${mask("7999 123 456")}`,
    );
    expect(filter.censor("coords 55,7558, -37,6173 7999 123 456")).toBe(
      `coords 55,7558, -37,6173 ${mask("7999 123 456")}`,
    );
    expect(filter.censor("balance 1,234,567,890 79991234567")).toBe(
      `balance 1,234,567,890 ${mask("79991234567")}`,
    );
    expect(filter.censor("balance 1.234.567.890 79991234567")).toBe(
      `balance 1.234.567.890 ${mask("79991234567")}`,
    );
    expect(filter.censor("balance 1 234 567 890 79991234567")).toBe(
      `balance 1 234 567 890 ${mask("79991234567")}`,
    );
    expect(filter.censor("1234567890123456 79991234567")).toBe(
      `1234567890123456 ${mask("79991234567")}`,
    );
    expect(filter.censor("1234567890123456 7999 123 456")).toBe(
      `1234567890123456 ${mask("7999 123 456")}`,
    );
    expect(filter.censor("30.05.1999 12.30 7999 123 456")).toBe(
      `30.05.1999 12.30 ${mask("7999 123 456")}`,
    );
    expect(filter.censor("30.05.26 7999 123 456")).toBe(
      `30.05.26 ${mask("7999 123 456")}`,
    );
    expect(filter.censor("30.05.1999 79 99 123 456")).toBe(
      `30.05.1999 ${mask("79 99 123 456")}`,
    );
    expect(filter.censor("5.06.2026 7999 123 456")).toBe(
      `5.06.2026 ${mask("7999 123 456")}`,
    );
    expect(filter.censor("30.05.1234 2020 123")).toBe(
      mask("30.05.1234 2020 123"),
    );
    expect(filter.censor("7999 12 31 22 33")).toBe(mask("7999 12 31 22 33"));
    expect(filter.censor("1234567890123456 7\u200B999\u200B123\u200B456")).toBe(
      `1234567890123456 ${mask("7\u200B999\u200B123\u200B456")}`,
    );
    expect(filter.censor("version 1.2.3 7999 123 456")).toBe(
      `version 1.2.3 ${mask("7999 123 456")}`,
    );
    expect(filter.censor("version 1.2.3 202 555 0187")).toBe(
      `version 1.2.3 ${mask("202 555 0187")}`,
    );
    expect(filter.censor("call 7999 123 456 202 555 0187")).toBe(
      `call ${mask("7999 123 456")} ${mask("202 555 0187")}`,
    );
    expect(filter.censor("uuid 550e8400-e29b-41d4-a716-446655440000")).toBe(
      "uuid 550e8400-e29b-41d4-a716-446655440000",
    );
    expect(filter.censor("order ABC123 456 7999 123 456")).toBe(
      `order ABC123 456 ${mask("7999 123 456")}`,
    );
    expect(
      filter.censor("uuid 550e8400-e29b-41d4-a716-446655440000 202 555 0187"),
    ).toBe(`uuid 550e8400-e29b-41d4-a716-446655440000 ${mask("202 555 0187")}`);
  });

  it("keeps input length and is idempotent", () => {
    const input = "call +1 202 555 0187 or 79991234567";
    const once = filter.censor(input);
    const twice = filter.censor(once);
    expect(once.length).toBe(input.length);
    expect(twice).toBe(once);
  });

  it("preserves JavaScript string length for astral digit ranges", () => {
    const input = "call 𐒧𐒩𐒩𐒩𐒡𐒢𐒣𐒤𐒥𐒦𐒧 now";
    const output = filter.censor(input);
    expect(output).toBe(`call ${"*".repeat(22)} now`);
    expect(output.length).toBe(input.length);
  });

  it("does not censor short numbers, coordinates or date-like sequences", () => {
    expect(filter.censor("мой код 123456")).toBe("мой код 123456");
    expect(filter.censor("координаты 55.7558, 37.6173")).toBe(
      "координаты 55.7558, 37.6173",
    );
    expect(filter.censor("coords 55.7558 37.6173")).toBe(
      "coords 55.7558 37.6173",
    );
    expect(filter.censor("coords +55.7558 37.6173")).toBe(
      "coords +55.7558 37.6173",
    );
    expect(filter.censor("date 30.05.2026 12.30")).toBe(
      "date 30.05.2026 12.30",
    );
    expect(filter.censor("2026-03-22 12-34-56")).toBe("2026-03-22 12-34-56");
  });

  it("supports a method-level custom mask", () => {
    expect(filter.censor("+1 202 555 0187", "#")).toBe(
      mask("+1 202 555 0187", "#"),
    );
    expect(filter.censor("call 𐒧𐒩𐒩𐒩𐒡𐒢𐒣𐒤𐒥𐒦𐒧 now", "#")).toBe(
      `call ${maskLength("𐒧𐒩𐒩𐒩𐒡𐒢𐒣𐒤𐒥𐒦𐒧", "#")} now`,
    );
  });

  it("skips parenthesis-only input without scanning for phones", () => {
    expect(filter.censor("(".repeat(200))).toBe("(".repeat(200));
  });
});
