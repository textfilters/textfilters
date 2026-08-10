import {
  globalMatchSource,
  russianFamilyDictionary,
  russianRule,
} from "../authoring.js";

const SOS_SOURCE = globalMatchSource(
  String.raw`(?<!\p{L})(?<!без\s+)(?!соси\s+(?:леденец|палец)(?!\p{L}))(?:соси|отсоси)(?!\p{L})`,
);

export default russianFamilyDictionary([
  russianRule({
    id: "ru.vulgar.sos.narrow",
    category: "VULGAR",
    severity: "medium",
    source: SOS_SOURCE,
    match: "loose",
    loose: {},
  }),
]);
