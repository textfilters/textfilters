import {
  regexGroup,
  russianFamilyDictionary,
  russianRule,
  token,
} from "../authoring.js";

const MANDA_FORMS = [
  String.raw`манда`,
  String.raw`манду`,
  String.raw`мандой`,
] as const;

export default russianFamilyDictionary([
  russianRule({
    id: "ru.obscene.manda.family",
    category: "OBSCENE_MAT",
    severity: "high",
    source: token(regexGroup(MANDA_FORMS)),
    match: "strict",
  }),
]);
