import type { TextFilter } from "@textfilters/core";

export interface EmailFilterOptions {
  readonly matchObfuscated?: boolean;
  readonly allowedEmails?: readonly string[];
  readonly allowedUsernames?: readonly string[];
  readonly allowedDomains?: readonly string[];
}

export interface EmailFilter extends TextFilter {
  readonly name: "email";
}

export type CodePointRange = readonly [start: number, end: number];
