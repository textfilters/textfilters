export interface RussianCollisionPositiveCase {
  readonly input: string;
  readonly matchedText: string;
  readonly ruleId: string;
}

export interface RussianCollisionAdjacentCase {
  readonly input: string;
  readonly matchedText: string;
}

export const russianCollisionNeutralCases = [
  "соси леденец",
  "соси палец",
  "без сучка и задоринки",
  "без  сучка и задоринки",
  "сучки на доске",
  "с у ч к и на доске",
  "с-у-ч-к-и на доске",
  "с💩у💩ч💩к💩и на доске",
  "без с-у-ч-к-а и задоринки",
  "сука породы лабрадор",
  "с-у-к-а породы лабрадор",
  "щенная сука",
  "щенная  сука",
  "щенная с-у-к-а",
  "Huy Le",
  "H-u-y Le",
  "Nguyen Quang Huy",
  "Nguyen  Quang  Huy",
  "Nguyen Quang H-u-y",
  "Que huya ahora",
  "Que  huya ahora",
  "Que h-u-y-a ahora",
  "Huia bird",
  "H-u-i-a bird",
  "Pierre Gandon",
  "Pierre  Gandon",
  "Pierre G-a-n-d-o-n",
  "Пьер Гандон",
  "Пьер  Гандон",
  "Пьер Г-а-н-д-о-н",
  "Eban Goodstein",
  "E-b-a-n Goodstein",
  "Har Ebal",
  "Har  Ebal",
  "Har E-b-a-l",
  "www.ebu.ch",
  "www.e-b-u.ch",
  "EBET stock",
  "E-B-E-T stock",
  "EBET.NASDAQ",
  "E-B-E-T.NASDAQ",
  "CHMO enzyme",
  "C-H-M-O enzyme",
  "Oleksandr Chmyr",
  "Oleksandr  Chmyr",
  "Oleksandr C-H-M-Y-R",
  "Сергей Чмырь",
  "Сергей  Чмырь",
  "Сергей Ч-м-ы-р-ь",
  "підордер",
  "п-і-д-о-р-д-е-р",
  "підорган",
  "підорний",
  "Saya suka kopi",
  "Saya S-u-k-a kopi",
  "Alex Sukin",
  "Alex  Sukin",
  "Alex S-u-k-i-n",
  "Sukin Australia",
  "S-u-k-i-n Australia",
  "Jan Suchar",
  "Jan  Suchar",
  "Jan S-u-c-h-a-r",
  "Suku people",
  "S-u-k-u people",
  "jobation",
  "j-o-b-a-t-i-o-n",
  "Sri Lanka",
  "s-r-i Lanka",
  "Herne the Hunter",
  "H-e-r-n-e the Hunter",
  "Нuy Le",
  "Huу Le",
  "Ｈｕｙ Ｌｅ",
  "СHMO enzyme",
  "ＣＨＭＯ ｅｎｚｙｍｅ",
] as const;

export const russianCollisionPositiveCases = [
  {
    input: "сууука",
    matchedText: "сууука",
    ruleId: "ru.insult.suka.family",
  },
  {
    input: "сууучка",
    matchedText: "сууучка",
    ruleId: "ru.insult.suchka.family",
  },
  {
    input: "гааандооон",
    matchedText: "гааандооон",
    ruleId: "ru.insult.gandon.family",
  },
  {
    input: "соси леденецами",
    matchedText: "соси",
    ruleId: "ru.vulgar.sos.narrow",
  },
  {
    input: "соси палецами",
    matchedText: "соси",
    ruleId: "ru.vulgar.sos.narrow",
  },
  {
    input: "без сучка и задоринок",
    matchedText: "сучка",
    ruleId: "ru.insult.suchka.family",
  },
  {
    input: "сучки на досках",
    matchedText: "сучки",
    ruleId: "ru.insult.suchka.family",
  },
  {
    input: "сука породы лабрадоров",
    matchedText: "сука",
    ruleId: "ru.insult.suka.family",
  },
  {
    input: "нещенная сука",
    matchedText: "сука",
    ruleId: "ru.insult.suka.family",
  },
  {
    input: "Saya suka kopit",
    matchedText: "suka",
    ruleId: "ru.insult.suka.translit",
  },
  {
    input: "Alex Sukina",
    matchedText: "Sukina",
    ruleId: "ru.insult.suka.translit",
  },
  {
    input: "Sukin Australian",
    matchedText: "Sukin",
    ruleId: "ru.insult.suka.translit",
  },
  {
    input: "Jan Suchara",
    matchedText: "Suchara",
    ruleId: "ru.insult.suka.translit",
  },
  {
    input: "Suku peoples",
    matchedText: "Suku",
    ruleId: "ru.insult.suka.translit",
  },
  {
    input: "Saya S-u-k-a kopit",
    matchedText: "S-u-k-a",
    ruleId: "ru.insult.suka.translit",
  },
  {
    input: "Alek S-u-k-i-n",
    matchedText: "S-u-k-i-n",
    ruleId: "ru.insult.suka.translit",
  },
  {
    input: "Jane S-u-c-h-a-r",
    matchedText: "S-u-c-h-a-r",
    ruleId: "ru.insult.suka.translit",
  },
  {
    input: "Huy Lemon",
    matchedText: "Huy",
    ruleId: "ru.obscene.huy.translit",
  },
  {
    input: "Nguyen Quang Huya",
    matchedText: "Huya",
    ruleId: "ru.obscene.huy.translit",
  },
  {
    input: "Que huya ahoras",
    matchedText: "huya",
    ruleId: "ru.obscene.huy.translit",
  },
  {
    input: "Huia birds",
    matchedText: "Huia",
    ruleId: "ru.obscene.huy.translit",
  },
  {
    input: "Pierre Gandona",
    matchedText: "Gandona",
    ruleId: "ru.insult.gandon.translit",
  },
  {
    input: "Пьер Гандоны",
    matchedText: "Гандоны",
    ruleId: "ru.insult.gandon.family",
  },
  {
    input: "Pier G-a-n-d-o-n",
    matchedText: "G-a-n-d-o-n",
    ruleId: "ru.insult.gandon.split.loose",
  },
  {
    input: "jobations",
    matchedText: "jobations",
    ruleId: "ru.obscene.eb.translit",
  },
  {
    input: "Har Ebala",
    matchedText: "Ebala",
    ruleId: "ru.obscene.eb.translit",
  },
  {
    input: "Eban Goodsteinx",
    matchedText: "Eban",
    ruleId: "ru.insult.eb.translit",
  },
  {
    input: "www.ebu.chat",
    matchedText: "ebu.chat",
    ruleId: "ru.insult.eb.translit",
  },
  {
    input: "EBET stockx",
    matchedText: "EBET",
    ruleId: "ru.obscene.eb.translit.token.loose",
  },
  {
    input: "EBET.NASDAQX",
    matchedText: "EBET.NASDAQX",
    ruleId: "ru.obscene.ebet.translit.loose",
  },
  {
    input: "CHMO enzymex",
    matchedText: "CHMO",
    ruleId: "ru.insult.chmo.translit",
  },
  {
    input: "Oleksandr Chmyrem",
    matchedText: "Chmyrem",
    ruleId: "ru.insult.chmo.translit",
  },
  {
    input: "Сергей Чмыря",
    matchedText: "Чмыря",
    ruleId: "ru.insult.chmyr.family",
  },
  {
    input: "C-H-M-O enzymex",
    matchedText: "C-H-M-O",
    ruleId: "ru.insult.chmo.translit.split.loose",
  },
  {
    input: "Alexander C-H-M-Y-R",
    matchedText: "C-H-M-Y-R",
    ruleId: "ru.insult.chmo.translit.split.loose",
  },
  {
    input: "Сергей Ч-м-ы-р-я",
    matchedText: "Ч-м-ы-р-я",
    ruleId: "ru.insult.chmo.declined.split.loose",
  },
  {
    input: "підорский",
    matchedText: "підорский",
    ruleId: "ru.insult.pidor.family",
  },
  {
    input: "Sri Lankax",
    matchedText: "Sri",
    ruleId: "ru.vulgar.srat.translit.bare",
  },
  {
    input: "s-r-i Lankax",
    matchedText: "s-r-i",
    ruleId: "ru.vulgar.srat.split.loose",
  },
  {
    input: "Herne the Hunters",
    matchedText: "Herne",
    ruleId: "ru.euphemism.her.translit",
  },
  {
    input: "H-e-r-n-e the Hunters",
    matchedText: "H-e-r-n-e",
    ruleId: "ru.euphemism.her.translit.split.loose",
  },
] as const satisfies readonly RussianCollisionPositiveCase[];

export const russianCollisionAdjacentCases = [
  { input: "Huy Le, мудак", matchedText: "мудак" },
  { input: "CHMO enzyme, сука", matchedText: "сука" },
  {
    input: "без сучка и задоринки, гандон",
    matchedText: "гандон",
  },
  { input: "Sri Lanka, хер", matchedText: "хер" },
  { input: "Eban Goodstein, мудак", matchedText: "мудак" },
] as const satisfies readonly RussianCollisionAdjacentCase[];
