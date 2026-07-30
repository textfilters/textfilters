import {
  type ProfanityMatchOptions,
  type ProfanityMatchRange,
  type ProfanitySeverity,
} from "./types.js";

const hasTaxonomyFilters = (options: ProfanityMatchOptions): boolean =>
  options.categories !== undefined ||
  options.severities !== undefined ||
  options.minSeverity !== undefined;

export const collectedRangeMatchesTaxonomy = (
  options: ProfanityMatchOptions | undefined,
): ((range: Pick<ProfanityMatchRange, "category" | "severity">) => boolean) => {
  if (options === undefined || !hasTaxonomyFilters(options)) {
    return () => true;
  }

  const categories =
    options.categories === undefined ? undefined : new Set(options.categories);
  const severities =
    options.severities === undefined ? undefined : new Set(options.severities);
  const minSeverity = options.minSeverity;

  return (range) =>
    rangeMatchesTaxonomy(range, categories, severities, minSeverity);
};

const rangeMatchesTaxonomy = (
  match: Pick<ProfanityMatchRange, "category" | "severity">,
  categories:
    | ReadonlySet<NonNullable<ProfanityMatchRange["category"]>>
    | undefined,
  severities:
    | ReadonlySet<NonNullable<ProfanityMatchRange["severity"]>>
    | undefined,
  minSeverity: ProfanitySeverity | undefined,
): boolean =>
  (categories === undefined ||
    (match.category !== undefined && categories.has(match.category))) &&
  (severities === undefined ||
    (match.severity !== undefined && severities.has(match.severity))) &&
  (minSeverity === undefined ||
    (match.severity !== undefined &&
      isAtLeastSeverity(match.severity, minSeverity)));

const PROFANITY_SEVERITY_RANK: Record<ProfanitySeverity, number> = {
  soft: 0,
  low: 1,
  medium: 2,
  high: 3,
};

const isAtLeastSeverity = (
  severity: ProfanitySeverity,
  minSeverity: ProfanitySeverity,
): boolean =>
  PROFANITY_SEVERITY_RANK[severity] >= PROFANITY_SEVERITY_RANK[minSeverity];
