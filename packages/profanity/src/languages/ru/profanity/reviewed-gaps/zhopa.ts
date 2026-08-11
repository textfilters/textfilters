import {
  regexGroup,
  russianFamilyDictionary,
  russianRule,
  token,
} from "../authoring.js";

const ZHOPA_FORMS = [
  String.raw`жоп`,
  String.raw`жопа`,
  String.raw`жопе`,
  String.raw`жопу`,
  String.raw`жопы`,
  String.raw`жопой`,
  String.raw`жопам`,
  String.raw`жопами`,
  String.raw`жопах`,
  String.raw`жопный`,
  String.raw`жопк(?:а|и|е|у|ой|ами?|ах)`,
  String.raw`жопаст(?:ый|ая|ое|ые|ого|ому|ую|ой|ом|ым|ыми|ых)`,
  String.raw`жопищ(?:а|е|у|ей|ами?|ах)`,
  String.raw`жопошник(?:[а-яё]+)?`,
] as const;

const ZHOPA_SYMBOL_TAIL = String.raw`(?:4|@(?![\p{L}\p{N}]))`;
const ZHOPA_OBFUSCATED_TAIL = String.raw`(?:а|${ZHOPA_SYMBOL_TAIL})`;

export default russianFamilyDictionary([
  russianRule({
    id: "ru.vulgar.zhopa.family",
    category: "VULGAR",
    severity: "low",
    source: token(regexGroup(ZHOPA_FORMS)),
    match: "strict",
  }),
  russianRule({
    id: "ru.vulgar.zhopa.split.loose",
    category: "VULGAR",
    severity: "low",
    source: token(
      String.raw`(?:ж0п[^\p{L}\p{N}]*${ZHOPA_OBFUSCATED_TAIL}|жоп${ZHOPA_SYMBOL_TAIL}|ж[^\p{L}\p{N}]+[о0]п[^\p{L}\p{N}]*${ZHOPA_OBFUSCATED_TAIL})`,
    ),
    match: "loose",
    loose: {},
  }),
]);
