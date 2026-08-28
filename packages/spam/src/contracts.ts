import type { ModerationInput, TextGuard } from "@textfilters/core";

export const SPAM_BLOCK_REASONS = Object.freeze({
  empty: "empty",
  tooFast: "too_fast",
  duplicate: "duplicate",
  burst: "burst",
} as const);

export type SpamBlockReason =
  (typeof SPAM_BLOCK_REASONS)[keyof typeof SPAM_BLOCK_REASONS];

export type SpamDecision =
  | { readonly allowed: true }
  | { readonly allowed: false; readonly reason: SpamBlockReason };

export interface SpamGuardOptions {
  readonly minIntervalMs?: number;
  readonly duplicateWindowMs?: number;
  readonly burstWindowMs?: number;
  readonly burstMaxMessages?: number;
  readonly maxActors?: number;
}

export interface SpamGuard extends TextGuard {
  readonly name: "spam";
  check(input: ModerationInput): SpamDecision;
  reset(): void;
}
