export interface ScannerExclusions {
  readonly emails: ReadonlySet<string>;
  readonly usernames: ReadonlySet<string>;
  readonly domains: ReadonlySet<string>;
}

export interface ScannerOptions {
  readonly allowLocalhost: boolean;
  readonly allowSingleLabelDomain: boolean;
  readonly matchObfuscated: boolean;
  readonly exclusions: ScannerExclusions;
}

export const TOKEN_TYPE = {
  word: "word",
  at: "at",
  dot: "dot",
} as const;

export const TOKEN_VALUE = {
  atWord: "at",
  atSymbol: "@",
  dotWord: "dot",
  dotSymbol: ".",
} as const;

export const SCANNER_PUNCTUATION = {
  colon: ":",
  comma: ",",
  hyphen: "-",
} as const;

type TokenType = (typeof TOKEN_TYPE)[keyof typeof TOKEN_TYPE];

export interface Token {
  readonly type: TokenType;
  readonly value: string;
  readonly start: number;
  readonly end: number;
  readonly wrapped: boolean;
}

export interface EmailCandidate {
  readonly kind: "direct" | "obfuscated";
  readonly local: string;
  readonly labels: readonly string[];
  readonly start: number;
  readonly end: number;
}
