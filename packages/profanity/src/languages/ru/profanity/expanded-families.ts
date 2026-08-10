import {
  cyrillicSuffix,
  globalMatchSource,
  regexGroup,
  russianFamilyDictionary,
  russianRule,
  token,
} from "./authoring.js";

const CYRILLIC_WORD_TAIL = cyrillicSuffix;

const EB_EXTENDED_FORMS = regexGroup([
  String.raw`[её]б(?:а|ы)рь`,
  String.raw`[её]бош(?:ить|у|ишь|ит|им|ите|ат|ил(?:а|и|о)?)`,
  String.raw`(?:подза|при|взъ|недо)еб(?:ать|ал(?:а|и|о)?|аться|ался|алась|ались|ись)`,
]);

const EB_EXTENDED_TRANSLIT = regexGroup([
  String.raw`[eеyу][bьв][aа]r`,
  String.raw`[yу][oо][bьв][aа]r`,
  String.raw`[eеyу][bьв][oо]s[hн]i[tт]`,
]);

const PIZD_PREFIXES = String.raw`(?:вы|от|до|на|пере|при|под|с|рас)`;
const PIZD_EXTENDED_FORMS = String.raw`${PIZD_PREFIXES}пизд(?:ить|еться|еть|нут(?:ый|ая|ое|ые|ого|ому|ую|ой|ом|ым|ыми|ых))`;
const PIZD_EXTENDED_TRANSLIT = String.raw`(?:s|v[yу]|n[aа]|[pр][oо]d)?[pр]izd(?:i[tт]|[eе][tт])`;

const HUYAR_TAIL = regexGroup([
  String.raw`ить`,
  String.raw`ю`,
  String.raw`ишь`,
  String.raw`ит`,
  String.raw`им`,
  String.raw`ите`,
  String.raw`ят`,
  String.raw`ил`,
  String.raw`ила`,
  String.raw`или`,
  String.raw`ило`,
  String.raw`ь`,
  String.raw`ьте`,
]);

const HUYAR_FORMS = String.raw`(?:а|в|при|под|рас|с)?хуяр${HUYAR_TAIL}`;
const HUY_QUANTITY_FORMS = String.raw`доху(?:я|ища|ялиард${CYRILLIC_WORD_TAIL})`;
const HUY_COMPOUNDS = regexGroup([
  String.raw`мозго[её]б`,
  String.raw`ското[её]б`,
  String.raw`хуепутало`,
  String.raw`хуеморд${CYRILLIC_WORD_TAIL}`,
  String.raw`хуеголов${CYRILLIC_WORD_TAIL}`,
  String.raw`хуегрыз${CYRILLIC_WORD_TAIL}`,
  String.raw`хуемраз${CYRILLIC_WORD_TAIL}`,
  String.raw`хуем[её]т${CYRILLIC_WORD_TAIL}`,
  String.raw`хуепл[её]т${CYRILLIC_WORD_TAIL}`,
  String.raw`хуеглот${CYRILLIC_WORD_TAIL}`,
  String.raw`хуежоп${CYRILLIC_WORD_TAIL}`,
]);

const HUY_EXTENDED_TRANSLIT = regexGroup([
  String.raw`d[oо][hн]u[yу][aа]`,
  String.raw`[hн]u[yу][aа]r`,
]);

const MUDACH_FORMS = regexGroup([
  String.raw`мудачк(?:а|и|е|у|ой|ами?|ах)`,
  String.raw`мудачь(?:[её]|я|ю|[её]м)`,
  String.raw`мудачок${CYRILLIC_WORD_TAIL}`,
  String.raw`мудачин${CYRILLIC_WORD_TAIL}`,
  String.raw`мудачеств${CYRILLIC_WORD_TAIL}`,
]);
const PIDOR_DERIVATIVES = String.raw`пидерас(?:[а-яё]+)?`;

const SUCHON_FORMS = regexGroup([
  String.raw`суч[оеё]н(?:ок|к(?:а|у|ом|е|и|ов|ам|ами|ах)|ыш${CYRILLIC_WORD_TAIL})`,
]);

const GOVNO_DERIVATIVES = regexGroup([
  String.raw`говнючк(?:а|и|е|у|ой|ами?|ах)`,
  String.raw`говно(?:ед|код)${CYRILLIC_WORD_TAIL}`,
  String.raw`дерьмоед${CYRILLIC_WORD_TAIL}`,
  String.raw`дерьмец${CYRILLIC_WORD_TAIL}`,
  String.raw`срач(?:ник|ка)?${CYRILLIC_WORD_TAIL}`,
]);

const GOVNIST_TAIL = regexGroup([
  String.raw`ый`,
  String.raw`ая`,
  String.raw`ое`,
  String.raw`ые`,
  String.raw`ого`,
  String.raw`ому`,
  String.raw`ую`,
  String.raw`ой`,
  String.raw`ом`,
  String.raw`ым`,
  String.raw`ыми`,
  String.raw`ых`,
]);

const OBOSSYV_FORMS = String.raw`обоссыв(?:аться|аюсь|аешься|ается|аемся|аетесь|аются|ался|алась|ались|айся)`;
const OBOSS_FORMS = String.raw`обосс(?:ать|ался|алась|ались|анный|анная|анное|анные|анного|анному|анную|анной|анном|анным|анными|анных)`;

const SSAT_FORMS = String.raw`(?:на|за|об)?сс(?:ать|у|ышь|ыт|ым|ыте|ут|ал(?:а|и|о)?)`;
const PERDET_FORMS = regexGroup([
  String.raw`(?:перд(?:еть|ун${CYRILLIC_WORD_TAIL}|[её]ж${CYRILLIC_WORD_TAIL})|п[её]рн(?:уть|ул(?:а|и|о)?))`,
  String.raw`[pр][eе]rd[eе][tт]`,
]);
const BZDET_FORMS = String.raw`бзд(?:еть|ун${CYRILLIC_WORD_TAIL}|ишь|ит|ят|ел(?:а|и|о)?)`;
const SCATOLOGY_INSULTS = regexGroup([
  String.raw`срак(?:а|и|е|у|ой|ами?|ах)`,
  String.raw`ссыкло${CYRILLIC_WORD_TAIL}`,
  String.raw`ссыкун${CYRILLIC_WORD_TAIL}`,
  String.raw`ссыкух${CYRILLIC_WORD_TAIL}`,
]);

const SRAT_EXTENDED_FORMS = regexGroup([
  String.raw`(?:на|про|пере|у)ср(?:ать(?:ся)?|ался|алась|ались)`,
  String.raw`(?:вы|по|за)ср(?:аться|ался|алась|ались)`,
]);

const CHMOSHN_TAIL = regexGroup([
  String.raw`ый`,
  String.raw`ая`,
  String.raw`ое`,
  String.raw`ые`,
  String.raw`ого`,
  String.raw`ому`,
  String.raw`ую`,
  String.raw`ой`,
  String.raw`ом`,
  String.raw`ым`,
  String.raw`ыми`,
  String.raw`ых`,
  String.raw`о`,
]);

const CHMO_DERIVATIVES = regexGroup([
  String.raw`чмошн${CHMOSHN_TAIL}`,
  String.raw`чмошк(?:а|и|е|у|ой|ами?|ах)`,
  String.raw`(?:за)?чмор(?:ить|ю|ишь|ит|им|ите|ят|ил(?:а|и|о)?)`,
]);

const SHLYUHA_DERIVATIVES = regexGroup([
  String.raw`шлюшечк(?:а|и|е|у|ой|ами?|ах)`,
  String.raw`шлюшечек`,
  String.raw`шлюх[её]нок${CYRILLIC_WORD_TAIL}`,
  String.raw`шалавк(?:а|и|е|у|ой|ами?|ах)`,
  String.raw`шалавист${CYRILLIC_WORD_TAIL}`,
]);

const HREN_FORMS = regexGroup([
  String.raw`хрен`,
  String.raw`нахрен`,
  String.raw`похрен`,
  String.raw`хреново`,
  String.raw`охрен(?:еть|ею|еешь|еет|еем|еете|еют|ел(?:а|и|о)?|ей|ейте)`,
]);

const ZALUPAT_TAIL = regexGroup([
  String.raw`ться`,
  String.raw`юсь`,
  String.raw`ешься`,
  String.raw`ется`,
  String.raw`емся`,
  String.raw`етесь`,
  String.raw`ются`,
  String.raw`лся`,
  String.raw`лась`,
  String.raw`лось`,
  String.raw`лись`,
  String.raw`йся`,
  String.raw`йтесь`,
]);

const SSAT_TRANSLIT = String.raw`ss[aа][tт]`;
const SSAT_TAKE_THE_PREFIX = String.raw`[tт][aа][kк][eе]\s+[tт][hн][eе]`;
const SSAT_SCORE_SUFFIX = String.raw`s[cс][oо]r[eе]s?`;
const SSAT_ORG_SUFFIX = String.raw`[oо]rg`;
const SSAT_TRANSLIT_SOURCE = globalMatchSource(
  String.raw`(?<!\p{L})(?<!${SSAT_TAKE_THE_PREFIX}\s+)(?!${SSAT_TRANSLIT}\s+${SSAT_SCORE_SUFFIX}(?!\p{L}))(?!${SSAT_TRANSLIT}\.${SSAT_ORG_SUFFIX}(?!\p{L}))${SSAT_TRANSLIT}(?!\p{L})`,
);

const INSULT_TRANSLITERATIONS = regexGroup([
  String.raw`[mм]ud[aа][cс][hн][oо][kк]`,
  String.raw`[cс][hн][mм][oо]s[hн][kк][aа]`,
]);

const SCATOLOGY_TRANSLITERATIONS = regexGroup([String.raw`g[oо]vn[oо][eе]d`]);

export default russianFamilyDictionary([
  russianRule({
    id: "ru.vulgar.ahue.split.loose",
    category: "VULGAR",
    severity: "medium",
    source: globalMatchSource(
      String.raw`(?<!\p{L})а[^\p{L}\p{N}]*х[^\p{L}\p{N}]*у[^\p{L}\p{N}]*е[^\p{L}\p{N}]*л[^\p{L}\p{N}]*[аио](?!\p{L})`,
    ),
    match: "loose",
    loose: {},
  }),
  russianRule({
    id: "ru.obscene.eb.extended.family",
    category: "OBSCENE_MAT",
    severity: "high",
    source: token(EB_EXTENDED_FORMS),
  }),
  russianRule({
    id: "ru.obscene.eb.extended.translit",
    category: "OBSCENE_MAT",
    severity: "high",
    source: token(EB_EXTENDED_TRANSLIT),
    match: "strict",
  }),
  russianRule({
    id: "ru.obscene.pizd.prefixed.family",
    category: "OBSCENE_MAT",
    severity: "high",
    source: token(PIZD_EXTENDED_FORMS),
  }),
  russianRule({
    id: "ru.obscene.pizd.prefixed.translit",
    category: "OBSCENE_MAT",
    severity: "high",
    source: token(PIZD_EXTENDED_TRANSLIT),
    match: "strict",
  }),
  russianRule({
    id: "ru.vulgar.huyar.family",
    category: "VULGAR",
    severity: "medium",
    source: token(HUYAR_FORMS),
  }),
  russianRule({
    id: "ru.vulgar.huy.quantity",
    category: "VULGAR",
    severity: "medium",
    source: token(HUY_QUANTITY_FORMS),
  }),
  russianRule({
    id: "ru.obscene.huy.compounds",
    category: "OBSCENE_MAT",
    severity: "high",
    source: token(HUY_COMPOUNDS),
  }),
  russianRule({
    id: "ru.vulgar.huy.extended.translit",
    category: "VULGAR",
    severity: "medium",
    source: token(HUY_EXTENDED_TRANSLIT),
    match: "strict",
  }),
  russianRule({
    id: "ru.insult.mudach.family",
    category: "STRONG_INSULT",
    severity: "medium",
    source: token(MUDACH_FORMS),
  }),
  russianRule({
    id: "ru.insult.pidor.derivatives",
    category: "STRONG_INSULT",
    severity: "high",
    source: token(PIDOR_DERIVATIVES),
  }),
  russianRule({
    id: "ru.insult.suchon.family",
    category: "STRONG_INSULT",
    severity: "medium",
    source: token(SUCHON_FORMS),
  }),
  russianRule({
    id: "ru.vulgar.govno.derivatives",
    category: "VULGAR",
    severity: "low",
    source: token(GOVNO_DERIVATIVES),
  }),
  russianRule({
    id: "ru.vulgar.govnist.family",
    category: "VULGAR",
    severity: "low",
    source: token(String.raw`говнист${GOVNIST_TAIL}`),
  }),
  russianRule({
    id: "ru.vulgar.obossyv.family",
    category: "VULGAR",
    severity: "low",
    source: token(OBOSSYV_FORMS),
  }),
  russianRule({
    id: "ru.vulgar.oboss.family",
    category: "VULGAR",
    severity: "low",
    source: token(OBOSS_FORMS),
  }),
  russianRule({
    id: "ru.vulgar.srat.extended",
    category: "VULGAR",
    severity: "low",
    source: token(SRAT_EXTENDED_FORMS),
  }),
  russianRule({
    id: "ru.vulgar.ssat.family",
    category: "VULGAR",
    severity: "low",
    source: token(SSAT_FORMS),
  }),
  russianRule({
    id: "ru.vulgar.perdet.family",
    category: "VULGAR",
    severity: "low",
    source: token(PERDET_FORMS),
  }),
  russianRule({
    id: "ru.vulgar.bzdet.family",
    category: "VULGAR",
    severity: "low",
    source: token(BZDET_FORMS),
  }),
  russianRule({
    id: "ru.insult.scatology.family",
    category: "STRONG_INSULT",
    severity: "low",
    source: token(SCATOLOGY_INSULTS),
  }),
  russianRule({
    id: "ru.insult.chmo.derivatives",
    category: "STRONG_INSULT",
    severity: "medium",
    source: token(CHMO_DERIVATIVES),
  }),
  russianRule({
    id: "ru.insult.shlyuha.derivatives",
    category: "STRONG_INSULT",
    severity: "high",
    source: token(SHLYUHA_DERIVATIVES),
  }),
  russianRule({
    id: "ru.euphemism.hren.family",
    category: "EUPHEMISM",
    severity: "low",
    source: token(HREN_FORMS),
  }),
  russianRule({
    id: "ru.obscene.zalupat.family",
    category: "OBSCENE_MAT",
    severity: "high",
    source: token(String.raw`залупа${ZALUPAT_TAIL}`),
  }),
  russianRule({
    id: "ru.vulgar.ssat.translit",
    category: "VULGAR",
    severity: "low",
    source: SSAT_TRANSLIT_SOURCE,
    match: "loose",
    loose: {},
  }),
  russianRule({
    id: "ru.insult.extended.translit",
    category: "STRONG_INSULT",
    severity: "medium",
    source: token(INSULT_TRANSLITERATIONS),
    match: "strict",
  }),
  russianRule({
    id: "ru.vulgar.scatology.translit",
    category: "VULGAR",
    severity: "low",
    source: token(SCATOLOGY_TRANSLITERATIONS),
    match: "strict",
  }),
]);
