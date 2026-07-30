import {
  hasInlineExtensionMarker,
  hasLeftBoundary,
  hasRightBoundary,
  isBoundary,
  previousContent,
} from "./boundaries.js";
import {
  extendTimeSuffixEnd,
  getIpv4PortEnd,
  getIpv6TailFieldEnd,
  getLeadingDecimalPhoneSuffixStart,
  getLeadingFormattedAmountPhoneSuffixStart,
  getLeadingTimeEnd,
  getLeadingVersionPhoneSuffixStart,
  getMinuteAfterTimeEnd,
  getNonContactNumericMetadataEnd,
  getSecondAfterTimeEnd,
  getSignedLongitudeEnd,
  getStructuredFalsePositive,
  getStructuredPrefixEnd,
  hasDayFirstDatePrefix,
  hasMonthFirstDatePrefix,
  hasPhoneLabelBefore,
  hasYearFirstDatePrefix,
  isClearPhoneSuffix,
  isLabeledBookIdentifier,
  isLocalGroupedPhoneSuffix,
  isRecoverablePhoneSuffix,
  isUuidNumericSuffix,
  isValidTimeParts,
  separatorHas,
} from "./false-positives.js";
import { COMBINING_MARK_RE, type TextMeta, WHITESPACE_RE } from "./meta.js";
import { isValidPhoneGroups } from "./phone-groups.js";
import { type CodePointRange } from "./ranges.js";

interface PhoneCandidate {
  readonly start: number;
  readonly end: number;
}

interface RejectedPhoneRun {
  readonly rejectedUntil: number;
}

const parsePhoneCandidate = (
  meta: TextMeta,
  start: number,
): PhoneCandidate | RejectedPhoneRun | null => {
  const firstRaw = meta.raw[start];
  let previous = start - 1;
  while (previous >= 0 && meta.zeroWidth[previous]) previous--;
  const previousRaw = previous >= 0 ? meta.raw[previous] : "";
  if (firstRaw === "-") {
    // Negative signed longitudes can begin with "-", but phones cannot.
    const signedLongitudeEnd = getSignedLongitudeEnd(meta, start);
    return signedLongitudeEnd !== null
      ? { rejectedUntil: signedLongitudeEnd }
      : null;
  }
  if (!(meta.digit[start] || firstRaw === "+" || firstRaw === "(")) {
    return null;
  }
  if (firstRaw === "+") {
    const signedLongitudeEnd = getSignedLongitudeEnd(meta, start);
    if (signedLongitudeEnd !== null) {
      return { rejectedUntil: signedLongitudeEnd };
    }
  }
  if (firstRaw === "(") {
    let cursor = start + 1;
    while (
      cursor < meta.codePoints.length &&
      (meta.zeroWidth[cursor] ||
        WHITESPACE_RE.test(meta.raw[cursor]) ||
        meta.raw[cursor] === "(")
    ) {
      cursor++;
    }
    if (cursor >= meta.codePoints.length || !meta.digit[cursor]) {
      return { rejectedUntil: cursor };
    }
  }
  if (meta.digit[start] && separatorHas(previousRaw, ":.")) {
    const ipv6TailFieldEnd = getIpv6TailFieldEnd(meta, start);
    if (ipv6TailFieldEnd !== null) {
      return { rejectedUntil: ipv6TailFieldEnd };
    }

    const ipv4PortEnd = getIpv4PortEnd(meta, start);
    if (ipv4PortEnd !== null) return { rejectedUntil: ipv4PortEnd };

    const timeFieldEnd =
      getSecondAfterTimeEnd(meta, start) ?? getMinuteAfterTimeEnd(meta, start);
    if (timeFieldEnd !== null) return { rejectedUntil: timeFieldEnd };
  }
  const followsPhoneLabelPeriod =
    previousRaw === "." && previous >= 0 && hasPhoneLabelBefore(meta, previous);
  if (
    meta.digit[start] &&
    (previousRaw === "+" || (previousRaw === "." && !followsPhoneLabelPeriod))
  ) {
    return null;
  }

  let pos = start;
  let hasPlus = false;
  let lastDigitPos = -1;
  let currentGroup = "";
  let currentGroupStart = -1;
  let currentGroupEnd = -1;
  const groups: string[] = [];
  const groupStarts: number[] = [];
  const groupEnds: number[] = [];
  const groupSeparators: string[] = [];
  const parenthesisPositions: number[] = [];
  let pendingSeparator = "";
  const wrapperStart = firstRaw === "+" ? previousContent(meta, start - 1) : -1;
  const candidateStart =
    firstRaw === "+" && wrapperStart >= 0 && meta.raw[wrapperStart] === "("
      ? wrapperStart
      : start;
  if (candidateStart !== start) parenthesisPositions.push(candidateStart);

  const pushCurrentGroup = (): void => {
    if (!currentGroup) return;
    groups.push(currentGroup);
    groupStarts.push(currentGroupStart);
    groupEnds.push(currentGroupEnd);
    currentGroup = "";
    currentGroupStart = -1;
    currentGroupEnd = -1;
  };

  if (firstRaw === "+") {
    hasPlus = true;
    pos++;
  }

  while (pos < meta.codePoints.length) {
    const raw = meta.raw[pos];
    if (!raw) {
      pos++;
      continue;
    }

    if (meta.zeroWidth[pos]) {
      pos++;
      continue;
    }

    if (meta.digit[pos]) {
      if (!currentGroup) {
        if (groups.length > groupSeparators.length) {
          groupSeparators.push(pendingSeparator);
          pendingSeparator = "";
        }
        currentGroupStart = pos;
      }
      currentGroup += raw;
      lastDigitPos = pos;
      currentGroupEnd = pos + 1;
      pos++;
      continue;
    }

    if (raw === "(" || raw === ")") {
      parenthesisPositions.push(pos);
      pushCurrentGroup();
      if (groups.length > 0) pendingSeparator += raw;
      pos++;
      continue;
    }

    if (meta.groupSeparator[pos]) {
      pushCurrentGroup();
      if (groups.length > 0) pendingSeparator += raw;
      pos++;
      continue;
    }

    break;
  }

  pushCurrentGroup();
  if (lastDigitPos < 0) return null;

  const end = lastDigitPos + 1;
  let candidateEnd = end;
  while (candidateEnd < pos) {
    if (meta.zeroWidth[candidateEnd] || meta.raw[candidateEnd] === ")") {
      candidateEnd++;
      continue;
    }
    if (WHITESPACE_RE.test(meta.raw[candidateEnd])) {
      let next = candidateEnd + 1;
      while (
        next < pos &&
        (meta.zeroWidth[next] || WHITESPACE_RE.test(meta.raw[next]))
      ) {
        next++;
      }
      if (next < pos && meta.raw[next] === ")") {
        candidateEnd++;
        continue;
      }
    }
    break;
  }
  // Trailing combining marks belong to the phone token and should not expose it.
  while (
    candidateEnd < meta.codePoints.length &&
    COMBINING_MARK_RE.test(meta.raw[candidateEnd])
  ) {
    candidateEnd++;
  }
  const nonContactNumericMetadataEnd = getNonContactNumericMetadataEnd(
    meta,
    candidateStart,
    {
      end: candidateEnd,
      groupEnds,
      groups,
      groupStarts,
      separators: groupSeparators,
    },
  );
  if (nonContactNumericMetadataEnd !== null) {
    return { rejectedUntil: nonContactNumericMetadataEnd };
  }
  const hasClosingParenthesisBefore = (limit: number): boolean =>
    parenthesisPositions.some(
      (parenPos) => parenPos < limit && meta.raw[parenPos] === ")",
    );
  const hasPhoneParenthesesBefore = (limit: number): boolean =>
    meta.raw[candidateStart] === "(" && hasClosingParenthesisBefore(limit);
  const hasParentheses =
    // Only a real leading wrapper may relax group validation; a stray ")" in an
    // ID-like value and an unmatched "(" must not make it look like a phone.
    hasPhoneParenthesesBefore(candidateEnd);

  const structuredFalsePositive = getStructuredFalsePositive(
    groups,
    groupSeparators,
    {
      hasPlus,
    },
  );
  if (structuredFalsePositive) {
    const hasDatePrefix =
      structuredFalsePositive === "datetime" &&
      groups.length >= 3 &&
      (hasYearFirstDatePrefix(groups, groupSeparators) ||
        hasMonthFirstDatePrefix(groups, groupSeparators) ||
        hasDayFirstDatePrefix(groups, groupSeparators));
    const hasTimeAfterDate =
      hasDatePrefix &&
      isValidTimeParts(groups[3], groups[4], groupSeparators[3]);
    return {
      rejectedUntil:
        structuredFalsePositive === "datetime"
          ? hasTimeAfterDate
            ? extendTimeSuffixEnd(meta, groupEnds[4] ?? groupEnds[2])
            : groupEnds[2]
          : groupEnds[groups.length - 1],
    };
  }
  const leadingTimeEnd = getLeadingTimeEnd(groups, groupSeparators, groupEnds);
  if (leadingTimeEnd !== null) return { rejectedUntil: leadingTimeEnd };
  const decimalPhoneSuffixStart = getLeadingDecimalPhoneSuffixStart(
    groups,
    groupSeparators,
    groupStarts,
  );
  if (decimalPhoneSuffixStart !== null) {
    return { rejectedUntil: decimalPhoneSuffixStart };
  }
  const formattedAmountPhoneSuffixStart =
    getLeadingFormattedAmountPhoneSuffixStart(
      groups,
      groupSeparators,
      groupStarts,
    );
  if (formattedAmountPhoneSuffixStart !== null) {
    return { rejectedUntil: formattedAmountPhoneSuffixStart };
  }
  const versionPhoneSuffixStart = getLeadingVersionPhoneSuffixStart(
    groups,
    groupSeparators,
    groupStarts,
  );
  if (versionPhoneSuffixStart !== null) {
    return { rejectedUntil: versionPhoneSuffixStart };
  }

  const boundaryStart =
    meta.raw[candidateStart] === "(" ||
    (meta.raw[candidateStart] === "+" &&
      hasPhoneLabelBefore(meta, candidateStart))
      ? candidateStart + 1
      : candidateStart;
  const hasLeadingPhoneLabel = hasPhoneLabelBefore(meta, candidateStart);

  for (
    let prefixLength = Math.min(groups.length - 1, 6);
    prefixLength >= 3;
    prefixLength--
  ) {
    const prefixFalsePositive = getStructuredFalsePositive(
      groups.slice(0, prefixLength),
      groupSeparators.slice(0, Math.max(prefixLength - 1, 0)),
      { hasPlus },
    );
    const suffixGroups = groups.slice(prefixLength);
    const suffixStartPos = groupStarts[prefixLength];
    const structuredPrefixEnd = getStructuredPrefixEnd(
      groups.slice(0, prefixLength),
      groupSeparators.slice(0, Math.max(prefixLength - 1, 0)),
      groupEnds.slice(0, prefixLength),
    );
    // Preserve structured prefixes, then rescan a real phone suffix separately.
    if (
      (prefixFalsePositive || structuredPrefixEnd !== null) &&
      suffixStartPos !== undefined &&
      isValidPhoneGroups(suffixGroups, {
        hasPlus: false,
        hasParentheses: false,
      })
    ) {
      return {
        rejectedUntil: structuredPrefixEnd ?? groupEnds[prefixLength - 1],
      };
    }
  }

  const hasRightBoundaryOrExtension =
    hasRightBoundary(meta, candidateEnd) ||
    hasInlineExtensionMarker(meta, candidateEnd);
  if (!hasLeftBoundary(meta, boundaryStart) || !hasRightBoundaryOrExtension) {
    if (!hasLeftBoundary(meta, boundaryStart)) {
      for (
        let suffixStartIndex = 1;
        suffixStartIndex < groups.length;
        suffixStartIndex++
      ) {
        const suffixStart = groupStarts[suffixStartIndex];
        const suffixGroups = groups.slice(suffixStartIndex);
        // Embedded numeric prefixes should not make collectRanges skip the phone.
        if (
          suffixStart !== undefined &&
          (isClearPhoneSuffix(suffixGroups) ||
            isLocalGroupedPhoneSuffix(suffixGroups)) &&
          isValidPhoneGroups(suffixGroups, {
            hasPlus: false,
            hasParentheses: false,
          }) &&
          isBoundary(meta, suffixStart, candidateEnd)
        ) {
          return { rejectedUntil: suffixStart };
        }
      }
    }
    return { rejectedUntil: candidateEnd };
  }
  if (
    isValidPhoneGroups(groups, {
      hasPlus,
      hasParentheses,
      hasPhoneLabel: hasLeadingPhoneLabel,
    })
  ) {
    if (isLabeledBookIdentifier(meta, candidateStart, groups)) {
      return { rejectedUntil: candidateEnd };
    }
    if (isUuidNumericSuffix(meta, candidateStart, candidateEnd, groups)) {
      return { rejectedUntil: candidateEnd };
    }
    return { start: candidateStart, end: candidateEnd };
  }

  for (let prefixLength = 1; prefixLength < groups.length; prefixLength++) {
    const prefixGroups = groups.slice(0, prefixLength);
    const prefixEnd = groupEnds[prefixLength - 1];
    const prefixHasParentheses = hasPhoneParenthesesBefore(prefixEnd);
    if (
      isBoundary(meta, boundaryStart, prefixEnd) &&
      isValidPhoneGroups(prefixGroups, {
        hasPlus,
        hasParentheses: prefixHasParentheses,
      }) &&
      !getStructuredFalsePositive(groups, groupSeparators, { hasPlus }) &&
      !getStructuredFalsePositive(
        prefixGroups,
        groupSeparators.slice(0, Math.max(prefixLength - 1, 0)),
        { hasPlus },
      )
    ) {
      return { start: candidateStart, end: prefixEnd };
    }
  }

  for (let suffixStart = 1; suffixStart < groups.length; suffixStart++) {
    const suffixGroups = groups.slice(suffixStart);
    const suffixStartPos = groupStarts[suffixStart];
    const suffixHasParentheses = hasClosingParenthesisBefore(end);
    const canRecoverSuffix =
      (groups[0]?.length ?? 0) > 4 || isRecoverablePhoneSuffix(suffixGroups);
    if (
      canRecoverSuffix &&
      suffixStartPos !== undefined &&
      isBoundary(meta, suffixStartPos, end) &&
      isValidPhoneGroups(suffixGroups, {
        hasPlus: false,
        hasParentheses: suffixHasParentheses,
      }) &&
      !getStructuredFalsePositive(
        suffixGroups,
        groupSeparators.slice(suffixStart),
        { hasPlus: false },
      )
    ) {
      return { rejectedUntil: suffixStartPos };
    }
  }
  return { rejectedUntil: end };
};

export const collectCandidateRanges = (
  meta: TextMeta,
): readonly CodePointRange[] => {
  const ranges: CodePointRange[] = [];
  collectCandidateRangeMatches(meta, (range) => {
    ranges.push(range);
  });
  return ranges;
};

export type PhoneCandidateRangeSink = (range: CodePointRange) => boolean | void;

export const collectCandidateRangeMatches = (
  meta: TextMeta,
  sink: PhoneCandidateRangeSink,
): boolean => {
  for (let i = 0; i < meta.codePoints.length; i++) {
    const candidate = parsePhoneCandidate(meta, i);
    if (!candidate) continue;
    if ("rejectedUntil" in candidate) {
      i = Math.max(i, candidate.rejectedUntil - 1);
      continue;
    }
    if (sink([candidate.start, candidate.end]) === false) return false;
    i = Math.max(i, candidate.end - 1);
  }
  return true;
};
