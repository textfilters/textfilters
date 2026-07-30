import {
  regexGroup,
  russianFamilyDictionary,
  russianRule,
  token,
} from "../authoring.js";

const YOPT_FORMS = [
  String.raw`[её]пт`,
  String.raw`[её]пта`,
  String.raw`[её]птваю`,
] as const;

export default russianFamilyDictionary([
  russianRule({
    id: "ru.vulgar.yopt.family",
    category: "VULGAR",
    severity: "medium",
    source: token(regexGroup(YOPT_FORMS)),
    match: "strict",
  }),
]);
