import { createProfanityFilter as createRuntimeProfanityFilter } from "./filter.js";
import { type ProfanityFilter, type ProfanityTermList } from "./types.js";

export const createProfanityFilter = (
  strictTerms?: ProfanityTermList,
  looseTerms?: ProfanityTermList,
): ProfanityFilter => createRuntimeProfanityFilter(strictTerms, looseTerms);

export interface CreateCustomProfanityFilterOptions {
  readonly strict?: ProfanityTermList;
  readonly loose?: ProfanityTermList;
}

export const createCustomProfanityFilter = (
  options: CreateCustomProfanityFilterOptions = {},
): ProfanityFilter =>
  createRuntimeProfanityFilter(options.strict ?? [], options.loose ?? []);

/** @deprecated Use createProfanityFilter instead. */
export const profanityFilter = createProfanityFilter;
