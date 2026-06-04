import type { TextCensor } from "@textfilters/core";

// Keep public API types in a dependency-light module so the entrypoint can
// re-export them without exposing parser internals.
export interface UrlFilterConfig {
  readonly tlds?: readonly string[];
  readonly maskChar?: string;
}

export const URL_FILTER_NAME = "url";

export type UrlFilter = TextCensor & {
  readonly name: typeof URL_FILTER_NAME;
};
