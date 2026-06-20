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
]);
