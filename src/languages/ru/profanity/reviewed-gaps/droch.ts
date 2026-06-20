import {
  regexGroup,
  russianFamilyDictionary,
  russianRule,
  token,
} from "../authoring.js";

const DROCH_FORMS = [
  String.raw`дрочить`,
  String.raw`дрочу`,
  String.raw`дрочишь`,
  String.raw`дрочит`,
  String.raw`дрочим`,
  String.raw`дрочите`,
  String.raw`дрочат`,
  String.raw`дрочил`,
  String.raw`дрочила`,
  String.raw`дрочили`,
  String.raw`дрочило`,
  String.raw`дрочер`,
  String.raw`дрочера`,
  String.raw`дрочеру`,
  String.raw`дрочером`,
  String.raw`дрочере`,
  String.raw`дрочеры`,
  String.raw`дрочеров`,
  String.raw`дрочерам`,
  String.raw`дрочерами`,
  String.raw`дрочерах`,
] as const;

export default russianFamilyDictionary([
  russianRule({
    id: "ru.vulgar.droch.family",
    category: "VULGAR",
    severity: "medium",
    source: token(regexGroup(DROCH_FORMS)),
    match: "strict",
  }),
]);
