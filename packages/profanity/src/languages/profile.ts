import {
  PROFANITY_FILTER_NAME,
  type ProfanityMatchOptions,
  type ReadonlyProfanityFilter,
} from "../types.js";

export interface ProfanityLanguageProfile {
  readonly id: string;
  readonly languageTag: string;
  readonly filter: ReadonlyProfanityFilter;
}

export interface ProfanityProfileSelection {
  readonly profile: ProfanityLanguageProfile;
  readonly matchOptions?: ProfanityMatchOptions;
}

export type ProfanityProfileInput =
  | ProfanityLanguageProfile
  | ProfanityProfileSelection;

export const defineProfanityLanguageProfile = (
  profile: ProfanityLanguageProfile,
): ProfanityLanguageProfile => {
  if (!isNonEmptyString(profile.id)) {
    throw new TypeError("Profanity language profile id must be non-empty.");
  }

  if (!isNonEmptyString(profile.languageTag)) {
    throw new TypeError(
      "Profanity language profile languageTag must be non-empty.",
    );
  }

  if (!isReadonlyProfanityFilter(profile.filter)) {
    throw new TypeError(
      `Profanity language profile "${profile.id}" has an invalid filter.`,
    );
  }

  return Object.freeze({ ...profile });
};

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

export const isReadonlyProfanityFilter = (
  value: unknown,
): value is ReadonlyProfanityFilter =>
  typeof value === "object" &&
  value !== null &&
  "name" in value &&
  value.name === PROFANITY_FILTER_NAME &&
  "analyze" in value &&
  typeof value.analyze === "function" &&
  "check" in value &&
  typeof value.check === "function" &&
  "censor" in value &&
  typeof value.censor === "function";
