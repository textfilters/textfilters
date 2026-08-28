export type TextRange = readonly [start: number, end: number];

export interface TextMatch {
  readonly start: number;
  readonly end: number;
  readonly value: string;
  readonly filter: string;
  readonly data?: unknown;
}

export interface TextFilterResult {
  readonly censored: string;
  readonly matches: readonly TextMatch[];
}

export interface TextFilter {
  readonly name: string;
  check(text: string): boolean;
  find(text: string): readonly TextMatch[];
  censor(text: string, mask?: string): string;
  process(text: string, mask?: string): TextFilterResult;
}

export interface ModerationInput {
  readonly actorKey: string;
  readonly text: string;
  readonly nowMs?: number;
}

export type GuardDecision =
  | { readonly allowed: true }
  | { readonly allowed: false; readonly reason: string };

export interface TextGuard {
  readonly name: string;
  check(input: ModerationInput): GuardDecision;
}

export type ModerationAllowedResult = {
  readonly allowed: true;
  readonly text: string;
  readonly matches: readonly TextMatch[];
};

export type ModerationBlockedResult = {
  readonly allowed: false;
  readonly guard: string;
  readonly reason: string;
};

export type ModerationResult =
  | ModerationAllowedResult
  | ModerationBlockedResult;

export interface ModerationPipelineOptions {
  readonly guards?: readonly TextGuard[];
  readonly filters?: readonly TextFilter[];
}

export interface ModerationPipeline {
  process(input: ModerationInput, mask?: string): ModerationResult;
}
