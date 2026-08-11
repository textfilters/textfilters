import {
  globalMatchSource,
  regexGroup,
  russianFamilyDictionary,
  russianRule,
  token,
} from "../authoring.js";

const SOS_FORMS = [
  String.raw`(?!соси\s+(?:леденец|палец)(?!\p{L}))соси`,
  String.raw`отсоси`,
] as const;

export default russianFamilyDictionary([
  russianRule({
    id: "ru.vulgar.sos.narrow",
    category: "VULGAR",
    severity: "medium",
    source: globalMatchSource(token(regexGroup(SOS_FORMS))),
    match: "loose",
    loose: {},
  }),
]);
