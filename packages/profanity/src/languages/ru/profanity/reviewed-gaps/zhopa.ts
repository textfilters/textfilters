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
] as const;

export default russianFamilyDictionary([
  russianRule({
    id: "ru.vulgar.zhopa.family",
    category: "VULGAR",
    severity: "medium",
    source: token(regexGroup(ZHOPA_FORMS)),
    match: "strict",
    originalSourceExemptions: ["жопа"],
  }),
]);
