import {
  regexGroup,
  russianFamilyDictionary,
  russianRule,
  token,
} from "../authoring.js";

const HUYLO_FORMS = [
  String.raw`ху(?:й|и)ло`,
  String.raw`ху(?:й|и)ла`,
  String.raw`ху(?:й|и)лу`,
  String.raw`ху(?:й|и)лом`,
  String.raw`ху(?:й|и)ле`,
  String.raw`ху(?:й|и)лы`,
  String.raw`ху(?:й|и)лам`,
  String.raw`ху(?:й|и)лами`,
  String.raw`ху(?:й|и)лах`,
  String.raw`ху(?:й|и)лоид(?:[а-яё]+)?`,
  String.raw`ху(?:й|и)ловидн(?:[а-яё]+)?`,
] as const;

export default russianFamilyDictionary([
  russianRule({
    id: "ru.insult.huylo.family",
    category: "STRONG_INSULT",
    severity: "high",
    source: token(regexGroup(HUYLO_FORMS)),
    match: "strict",
  }),
]);
