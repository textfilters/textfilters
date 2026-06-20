import {
  regexGroup,
  russianFamilyDictionary,
  russianRule,
  token,
} from "./authoring.js";

const YOPT_FORMS = [
  String.raw`[её]пт`,
  String.raw`[её]пта`,
  String.raw`[её]птваю`,
] as const;
const ZHOPA_FORMS = [
  String.raw`жопа`,
  String.raw`жопу`,
  String.raw`жопой`,
  String.raw`жопный`,
] as const;
const MANDA_FORMS = [
  String.raw`манда`,
  String.raw`манду`,
  String.raw`мандой`,
] as const;
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
] as const;
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
const SOS_FORMS = [
  String.raw`соси`,
  String.raw`отсоси`,
  String.raw`сосать`,
] as const;

export default russianFamilyDictionary([
  russianRule({
    id: "ru.vulgar.yopt.family",
    category: "VULGAR",
    severity: "medium",
    source: token(regexGroup(YOPT_FORMS)),
  }),
  russianRule({
    id: "ru.vulgar.zhopa.family",
    category: "VULGAR",
    severity: "medium",
    source: token(regexGroup(ZHOPA_FORMS)),
  }),
  russianRule({
    id: "ru.obscene.manda.family",
    category: "OBSCENE_MAT",
    severity: "high",
    source: token(regexGroup(MANDA_FORMS)),
  }),
  russianRule({
    id: "ru.insult.huylo.family",
    category: "STRONG_INSULT",
    severity: "high",
    source: token(regexGroup(HUYLO_FORMS)),
  }),
  russianRule({
    id: "ru.vulgar.droch.family",
    category: "VULGAR",
    severity: "medium",
    source: token(regexGroup(DROCH_FORMS)),
  }),
  russianRule({
    id: "ru.vulgar.sos.narrow",
    category: "VULGAR",
    severity: "medium",
    source: token(regexGroup(SOS_FORMS)),
  }),
]);
