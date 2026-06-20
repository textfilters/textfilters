import {
  regexGroup,
  russianFamilyDictionary,
  russianRule,
  token,
} from "../authoring.js";

const SOS_FORMS = [String.raw`соси`, String.raw`отсоси`] as const;

export default russianFamilyDictionary([
  russianRule({
    id: "ru.vulgar.sos.narrow",
    category: "VULGAR",
    severity: "medium",
    source: token(regexGroup(SOS_FORMS)),
    match: "strict",
  }),
]);
