import { describe, expect, it } from "vitest";

import {
  createPhoneFilter,
  filter,
  PHONE_FILTER_NAME,
  phoneFilter,
} from "../src/index.js";

const mask = (s: string, ch = "*") => ch.repeat(Array.from(s).length);
const maskLength = (s: string, ch = "*") => ch.repeat(s.length);

describe("textfilters phone package", () => {
  it("exposes old-compatible public API", () => {
    expect(filter.name).toBe(PHONE_FILTER_NAME);
    expect(phoneFilter()).toEqual(
      expect.objectContaining({ name: PHONE_FILTER_NAME }),
    );
  });

  it("normalizes empty and non-string public input through core", () => {
    expect(filter.censor("")).toBe("");
    expect(filter.censor(null)).toBe("");
    expect(filter.censor(undefined)).toBe("");
    expect(filter.censor(12345)).toBe("12345");
    expect(filter.censor({ toString: () => "+1 202 555 0187" })).toBe(
      mask("+1 202 555 0187"),
    );
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

  it("keeps reviewed non-contact numeric metadata unchanged", () => {
    const metadata =
      '{ "cursor": "1784477618588-0", "serverTs": 1784477618588 }';

    expect(filter.censor("-2147483648")).toBe("-2147483648");
    expect(filter.censor("user-2147483648")).toBe("user-2147483648");
    expect(filter.censor(metadata)).toBe(metadata);
    expect(filter.censor('{"cursor":1784477618588}')).toBe(
      '{"cursor":1784477618588}',
    );

    const cursorWithPhone = '{"cursor":"1784477618588-79991234567"}';
    const cursorSequenceWithPhone = '{"cursor":"1784477618588-0-79991234567"}';
    const serverTimestampWithPhone = '{"serverTs":"1784477618588-79991234567"}';

    expect(filter.censor(cursorWithPhone)).toBe(
      `{"cursor":"1784477618588-${mask("79991234567")}"}`,
    );
    expect(filter.censor(cursorSequenceWithPhone)).toBe(
      `{"cursor":"1784477618588-0-${mask("79991234567")}"}`,
    );
    expect(filter.censor(serverTimestampWithPhone)).toBe(
      `{"serverTs":"1784477618588-${mask("79991234567")}"}`,
    );

    const longJsonWhitespace = " ".repeat(49);
    const spacedServerTimestamp = `{"serverTs":${longJsonWhitespace}1784477618588}`;
    const spacedCursor = `{"cursor":${longJsonWhitespace}"1784477618588-0"}`;
    const spacedCursorWithPhone = `{"cursor":${longJsonWhitespace}"1784477618588-79991234567"}`;

    expect(filter.censor(spacedServerTimestamp)).toBe(spacedServerTimestamp);
    expect(filter.censor(spacedCursor)).toBe(spacedCursor);
    expect(filter.censor(spacedCursorWithPhone)).toBe(
      `{"cursor":${longJsonWhitespace}"1784477618588-${mask("79991234567")}"}`,
    );

    const escapedServerTimestamp = '{"server\\u0054s":1784477618588}';
    const escapedCursor = '{"cur\\u0073or":"1784477618588-0"}';
    const escapedServerTimestampWithPhone =
      '{"server\\u0054s":"1784477618588-79991234567"}';
    expect(filter.censor(escapedServerTimestamp)).toBe(escapedServerTimestamp);
    expect(filter.censor(escapedCursor)).toBe(escapedCursor);
    expect(filter.censor(escapedServerTimestampWithPhone)).toBe(
      `{"server\\u0054s":"1784477618588-${mask("79991234567")}"}`,
    );

    expect(filter.censor('{"CURSOR":1784477618588}')).toBe(
      `{"CURSOR":${mask("1784477618588")}}`,
    );
    expect(filter.censor('{"serverts":1784477618588}')).toBe(
      `{"serverts":${mask("1784477618588")}}`,
    );

    const zeroWidthServerTimestamp = '{"serverTs":"178447\u200B7618588"}';
    const zeroWidthCursorSequence = '{"cursor":"1784477618588-\u200B0"}';
    const trailingZeroWidthCursor = '{"cursor":"1784477618588\u200B"}';
    const zeroWidthServerTimestampWithPhone =
      '{"serverTs":"1784477618588\u200B-79991234567"}';
    const unicodeDigitServerTimestamp = '{"serverTs":"178447７618588"}';

    expect(filter.censor(zeroWidthServerTimestamp)).toBe(
      `{"serverTs":"${mask("178447\u200B7618588")}"}`,
    );
    expect(filter.censor(zeroWidthCursorSequence)).toBe(
      `{"cursor":"${mask("1784477618588")}-\u200B0"}`,
    );
    expect(filter.censor(trailingZeroWidthCursor)).toBe(
      `{"cursor":"${mask("1784477618588\u200B")}"}`,
    );
    expect(filter.censor(zeroWidthServerTimestampWithPhone)).toBe(
      `{"serverTs":"${mask("1784477618588")}\u200B-${mask("79991234567")}"}`,
    );
    expect(filter.censor(unicodeDigitServerTimestamp)).toBe(
      `{"serverTs":"${mask("178447７618588")}"}`,
    );

    expect(filter.censor('{"serverTs":"1784477618588-0"}')).toBe(
      `{"serverTs":"${mask("1784477618588")}-0"}`,
    );
    expect(filter.censor('{"cursor":"1784477618588-1"}')).toBe(
      `{"cursor":"${mask("1784477618588")}-1"}`,
    );

    expect(filter.censor('note, "serverTs":1784477618588')).toBe(
      `note, "serverTs":${mask("1784477618588")}`,
    );
    expect(filter.censor('"serverTs":1784477618588')).toBe(
      `"serverTs":${mask("1784477618588")}`,
    );
    expect(filter.censor('{"serverTs":1784477618588')).toBe(
      `{"serverTs":${mask("1784477618588")}`,
    );
    expect(filter.censor('note {"serverTs":1784477618588} after')).toBe(
      'note {"serverTs":1784477618588} after',
    );
    const nestedMetadata =
      'note {"nested":{"note":"{","serverTs":1784477618588}} after';
    expect(filter.censor(nestedMetadata)).toBe(nestedMetadata);
    const metadataAfterUnmatchedBrace =
      'note { stray {"serverTs":1784477618588}';
    expect(filter.censor(metadataAfterUnmatchedBrace)).toBe(
      metadataAfterUnmatchedBrace,
    );
    const metadataInsideMalformedObject =
      'note { stray {"serverTs":1784477618588}} after';
    expect(filter.censor(metadataInsideMalformedObject)).toBe(
      metadataInsideMalformedObject,
    );
    const metadataAfterMalformedString =
      'note {"broken":"oops {"serverTs":1784477618588}';
    expect(filter.censor(metadataAfterMalformedString)).toBe(
      metadataAfterMalformedString,
    );

    expect(filter.censor("-214748\u200B3648")).toBe(
      `-${mask("214748\u200B3648")}`,
    );
    expect(filter.censor("-２147483648")).toBe(`-${mask("２147483648")}`);
    expect(filter.censor("-\u200B2147483648")).toBe(
      `-\u200B${mask("2147483648")}`,
    );

    expect(filter.censor("-79991234567")).toBe(`-${mask("79991234567")}`);
    expect(filter.censor('{"phone":1784477618588}')).toBe(
      `{"phone":${mask("1784477618588")}}`,
    );
    expect(filter.censor('{"value":1784477618588}')).toBe(
      `{"value":${mask("1784477618588")}}`,
    );
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

  it("supports custom mask char", () => {
    const custom = createPhoneFilter({ maskChar: "#" });
    expect(custom.censor("+1 202 555 0187")).toBe(mask("+1 202 555 0187", "#"));
    expect(custom.censor("call 𐒧𐒩𐒩𐒩𐒡𐒢𐒣𐒤𐒥𐒦𐒧 now")).toBe(
      `call ${maskLength("𐒧𐒩𐒩𐒩𐒡𐒢𐒣𐒤𐒥𐒦𐒧", "#")} now`,
    );
  });

  it("keeps current null and undefined runtime behavior", () => {
    expect(filter.censor(null as unknown as string)).toBe("");
    expect(filter.censor(undefined as unknown as string)).toBe("");
  });

  it("skips parenthesis-only input without scanning for phones", () => {
    expect(filter.censor("(".repeat(200))).toBe("(".repeat(200));
  });
});
