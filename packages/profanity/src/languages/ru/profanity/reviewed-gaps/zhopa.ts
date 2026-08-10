import {
  globalMatchSource,
  regexGroup,
  russianFamilyDictionary,
  russianRule,
  token,
} from "../authoring.js";

const ZHOPA_FORMS = [
  String.raw`жоп(?![а-яё@40])`,
  String.raw`ж[о0]п[а@4]`,
  String.raw`жопе`,
  String.raw`жопу`,
  String.raw`жопы`,
  String.raw`жопой`,
  String.raw`жопам`,
  String.raw`жопами`,
  String.raw`жопах`,
  String.raw`жопный`,
  String.raw`жопк(?:а|и|е|у|ой|ами?|ах)`,
  String.raw`жопаст(?:ый|ая|ое|ые|ого|ому|ую|ой|ом|ым|ыми|ых)`,
  String.raw`жопищ(?:а|е|у|ей|ами?|ах)`,
  String.raw`жопошник(?:[а-яё]+)?`,
  String.raw`z[hн][oо][pр][aа]`,
  String.raw`z[hн][oо][pр][aа]s[tт][yу][yу]`,
] as const;

export default russianFamilyDictionary([
  russianRule({
    id: "ru.vulgar.zhopa.family",
    category: "VULGAR",
    severity: "low",
    source: token(regexGroup(ZHOPA_FORMS)),
    match: "strict-loose",
  }),
  russianRule({
    id: "ru.vulgar.zhopa.split.loose",
    category: "VULGAR",
    severity: "low",
    source: globalMatchSource(
      String.raw`(?<!\p{L})ж[^\p{L}\p{N}]*[о0][^\p{L}\p{N}]*п[^\p{L}\p{N}]*[а@4](?!\p{L})`,
    ),
    match: "loose",
    loose: {},
  }),
]);
