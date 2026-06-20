import {
  regexGroup,
  russianFamilyDictionary,
  russianRule,
  token,
} from "../authoring.js";

const ZHOPA_FORMS = [
  String.raw`жопа`,
  String.raw`жопу`,
  String.raw`жопой`,
  String.raw`жопный`,
] as const;

export default russianFamilyDictionary([
  russianRule({
    id: "ru.vulgar.zhopa.family",
    category: "VULGAR",
    severity: "medium",
    source: token(regexGroup(ZHOPA_FORMS)),
    match: "strict",
  }),
]);
