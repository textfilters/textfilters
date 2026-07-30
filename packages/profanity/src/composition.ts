import { normalizeTextInput } from "@textfilters/core";

import {
  analyzePreparedProfanity,
  canStreamProfanityMatches,
  checkPreparedProfanity,
  createPreparedProfanityInput,
  registerProfanityMatchStreamer,
  registerProfanityPreparedAnalyzer,
  streamPreparedProfanityMatches,
  type PreparedProfanityInput,
} from "./filter.js";
import {
  isReadonlyProfanityFilter,
  type ProfanityLanguageProfile,
  type ProfanityProfileInput,
  type ProfanityProfileSelection,
} from "./languages/profile.js";
import { PROFANITY_MATCH_MODE, textRangesForMode } from "./matches/ranges.js";
import { maskProfanityRanges } from "./token-ranges.js";
import {
  PROFANITY_FILTER_NAME,
  type ComposedProfanityFilter,
  type ProfiledProfanityMatchRange,
  type ProfanityMatchOptions,
  type ProfanityMatchRange,
  type ProfanitySeverity,
} from "./types.js";

interface NormalizedProfileSelection {
  readonly profile: ProfanityLanguageProfile;
  readonly sourceProfile: ProfanityLanguageProfile;
  readonly matchOptions?: ProfanityMatchOptions;
}

export const composeProfanityProfiles = (
  profiles: readonly ProfanityProfileInput[],
): ComposedProfanityFilter => {
  const selections = normalizeProfileSelections(profiles);

  const analyzePrepared = (
    input: PreparedProfanityInput,
    matchOptions?: ProfanityMatchOptions,
  ): ProfiledProfanityMatchRange[] => {
    return selections
      .flatMap(({ profile, matchOptions: profileOptions }) =>
        (
          analyzePreparedProfanity(
            profile.filter,
            input,
            intersectMatchOptions(profileOptions, matchOptions),
          ) ??
          profile.filter.analyze(
            input.text,
            intersectMatchOptions(profileOptions, matchOptions),
          )
        ).map((match) => matchWithProfile(match, profile)),
      )
      .sort(compareMatchesBySource);
  };

  const analyze = (
    text: unknown,
    matchOptions?: ProfanityMatchOptions,
  ): ProfiledProfanityMatchRange[] => {
    const source = normalizeTextInput(text);
    return analyzePrepared(createPreparedProfanityInput(source), matchOptions);
  };

  const composedFilter: ComposedProfanityFilter = Object.freeze({
    name: PROFANITY_FILTER_NAME,
    profileIds: Object.freeze(selections.map(({ profile }) => profile.id)),
    languageTags: Object.freeze([
      ...new Set(selections.map(({ profile }) => profile.languageTag)),
    ]),
    analyze,
    check: (text: unknown, matchOptions?: ProfanityMatchOptions) => {
      const source = normalizeTextInput(text);
      const input = createPreparedProfanityInput(source);
      return selections.some(({ profile, matchOptions: profileOptions }) => {
        const selectedOptions = intersectMatchOptions(
          profileOptions,
          matchOptions,
        );
        return (
          checkPreparedProfanity(profile.filter, input, selectedOptions) ??
          profile.filter.check(source, selectedOptions)
        );
      });
    },
    censor: (text: unknown, matchOptions?: ProfanityMatchOptions) => {
      const source = normalizeTextInput(text);
      const matches = analyzePrepared(
        createPreparedProfanityInput(source),
        matchOptions,
      );
      return maskProfanityRanges(
        source,
        textRangesForMode(matches, PROFANITY_MATCH_MODE.STRICT),
        textRangesForMode(matches, PROFANITY_MATCH_MODE.LOOSE),
      );
    },
  });

  registerProfanityPreparedAnalyzer(composedFilter, analyzePrepared);

  if (
    selections.every(({ profile }) => canStreamProfanityMatches(profile.filter))
  ) {
    registerProfanityMatchStreamer(
      composedFilter,
      (input, matchOptions, visit) => {
        for (const { profile, matchOptions: profileOptions } of selections) {
          const completed = streamPreparedProfanityMatches(
            profile.filter,
            input,
            intersectMatchOptions(profileOptions, matchOptions),
            (match) => visit(matchWithProfile(match, profile)),
          );

          if (completed === false) return false;
          if (completed === undefined) {
            throw new TypeError(
              `Profanity profile "${profile.id}" lost its streaming capability.`,
            );
          }
        }

        return true;
      },
    );
  }

  return composedFilter;
};

const normalizeProfileSelections = (
  profiles: readonly ProfanityProfileInput[],
): NormalizedProfileSelection[] => {
  if (!Array.isArray(profiles) || profiles.length === 0) {
    throw new TypeError(
      "composeProfanityProfiles() requires at least one language profile.",
    );
  }

  const selected = new Map<string, NormalizedProfileSelection>();

  for (const input of profiles as readonly unknown[]) {
    const selection = normalizeProfileSelection(input);
    const existing = selected.get(selection.profile.id);

    if (existing === undefined) {
      selected.set(selection.profile.id, selection);
      continue;
    }

    if (
      existing.sourceProfile === selection.sourceProfile &&
      sameMatchOptions(existing.matchOptions, selection.matchOptions)
    ) {
      continue;
    }

    throw new TypeError(
      `Multiple profanity profiles were provided with id "${selection.profile.id}".`,
    );
  }

  return [...selected.values()];
};

const normalizeProfileSelection = (
  input: unknown,
): NormalizedProfileSelection => {
  if (isProfanityLanguageProfile(input)) {
    return {
      sourceProfile: input,
      profile: snapshotProfile(input),
    };
  }

  if (
    typeof input === "object" &&
    input !== null &&
    "profile" in input &&
    isProfanityLanguageProfile(input.profile) &&
    (!("matchOptions" in input) ||
      input.matchOptions === undefined ||
      isMatchOptions(input.matchOptions))
  ) {
    const selection = input as ProfanityProfileSelection;
    return {
      sourceProfile: selection.profile,
      profile: snapshotProfile(selection.profile),
      ...(selection.matchOptions === undefined
        ? {}
        : { matchOptions: snapshotMatchOptions(selection.matchOptions) }),
    };
  }

  throw new TypeError("Invalid profanity language profile selection.");
};

const isProfanityLanguageProfile = (
  value: unknown,
): value is ProfanityLanguageProfile =>
  typeof value === "object" &&
  value !== null &&
  "id" in value &&
  typeof value.id === "string" &&
  value.id.trim().length > 0 &&
  "languageTag" in value &&
  typeof value.languageTag === "string" &&
  value.languageTag.trim().length > 0 &&
  "filter" in value &&
  isReadonlyProfanityFilter(value.filter);

const isMatchOptions = (value: unknown): value is ProfanityMatchOptions =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const snapshotProfile = (
  profile: ProfanityLanguageProfile,
): ProfanityLanguageProfile =>
  Object.freeze({
    id: profile.id,
    languageTag: profile.languageTag,
    filter: profile.filter,
  });

const snapshotMatchOptions = (
  options: ProfanityMatchOptions,
): ProfanityMatchOptions =>
  Object.freeze({
    ...(options.categories === undefined
      ? {}
      : { categories: Object.freeze([...options.categories]) }),
    ...(options.severities === undefined
      ? {}
      : { severities: Object.freeze([...options.severities]) }),
    ...(options.minSeverity === undefined
      ? {}
      : { minSeverity: options.minSeverity }),
  });

const sameMatchOptions = (
  left: ProfanityMatchOptions | undefined,
  right: ProfanityMatchOptions | undefined,
): boolean =>
  left === right ||
  (left !== undefined &&
    right !== undefined &&
    sameValues(left.categories, right.categories) &&
    sameValues(left.severities, right.severities) &&
    left.minSeverity === right.minSeverity);

const sameValues = <T>(
  left: readonly T[] | undefined,
  right: readonly T[] | undefined,
): boolean =>
  left === right ||
  (left !== undefined &&
    right !== undefined &&
    left.length === right.length &&
    left.every((value, index) => value === right[index]));

const matchWithProfile = (
  match: ProfanityMatchRange,
  profile: ProfanityLanguageProfile,
): ProfiledProfanityMatchRange =>
  Object.assign([match[0], match[1]] as [number, number], match, {
    profileId: profile.id,
    languageTag: profile.languageTag,
  });

const compareMatchesBySource = (
  left: ProfanityMatchRange,
  right: ProfanityMatchRange,
): number => left[0] - right[0] || left[1] - right[1];

const intersectMatchOptions = (
  profileOptions: ProfanityMatchOptions | undefined,
  callOptions: ProfanityMatchOptions | undefined,
): ProfanityMatchOptions | undefined => {
  if (profileOptions === undefined) return callOptions;
  if (callOptions === undefined) return profileOptions;

  return {
    ...(profileOptions.categories === undefined &&
    callOptions.categories === undefined
      ? {}
      : {
          categories: intersectValues(
            profileOptions.categories,
            callOptions.categories,
          ),
        }),
    ...(profileOptions.severities === undefined &&
    callOptions.severities === undefined
      ? {}
      : {
          severities: intersectValues(
            profileOptions.severities,
            callOptions.severities,
          ),
        }),
    ...(profileOptions.minSeverity === undefined &&
    callOptions.minSeverity === undefined
      ? {}
      : {
          minSeverity: strongestMinimumSeverity(
            profileOptions.minSeverity,
            callOptions.minSeverity,
          ),
        }),
  };
};

const intersectValues = <T>(
  profileValues: readonly T[] | undefined,
  callValues: readonly T[] | undefined,
): readonly T[] | undefined => {
  if (profileValues === undefined) return callValues;
  if (callValues === undefined) return profileValues;
  const accepted = new Set(callValues);
  return profileValues.filter((value) => accepted.has(value));
};

const PROFANITY_SEVERITY_RANK: Record<ProfanitySeverity, number> = {
  soft: 0,
  low: 1,
  medium: 2,
  high: 3,
};

const strongestMinimumSeverity = (
  profileSeverity: ProfanitySeverity | undefined,
  callSeverity: ProfanitySeverity | undefined,
): ProfanitySeverity | undefined => {
  if (profileSeverity === undefined) return callSeverity;
  if (callSeverity === undefined) return profileSeverity;

  return PROFANITY_SEVERITY_RANK[profileSeverity] >=
    PROFANITY_SEVERITY_RANK[callSeverity]
    ? profileSeverity
    : callSeverity;
};
