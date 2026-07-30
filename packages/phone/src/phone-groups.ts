export const isValidPhoneGroups = (
  groups: readonly string[],
  options: {
    readonly hasPlus: boolean;
    readonly hasParentheses: boolean;
    readonly hasPhoneLabel?: boolean;
  },
): boolean => {
  const digitsCount = groups.reduce((sum, group) => sum + group.length, 0);
  if (digitsCount < 10 || digitsCount > 15) return false;
  if (groups.length === 0) return false;
  if (groups.length === 1) return true;
  const hasPlusSevenSingleDigitTail =
    options.hasPlus &&
    groups.length === 9 &&
    groups[0] === "7" &&
    groups[1]?.length === 3 &&
    groups.slice(2).every((group) => group.length === 1);
  if (hasPlusSevenSingleDigitTail) return true;
  if (
    groups.length > 6 &&
    !(
      options.hasPlus &&
      groups.length <= 8 &&
      groups.every((group) => group.length <= 2)
    )
  ) {
    return false;
  }
  if (
    !options.hasPlus &&
    !options.hasPhoneLabel &&
    groups.every((group) => group.length <= 2)
  ) {
    return false;
  }

  const first = groups[0];
  const last = groups[groups.length - 1];
  if (first.length === 0 || first.length > 4) return false;
  if (last.length < 2) return false;

  if (
    !options.hasPlus &&
    !options.hasParentheses &&
    first.length === 4 &&
    !/^(?:[78]|00)/u.test(first)
  ) {
    return false;
  }

  for (let i = 1; i < groups.length; i++) {
    const len = groups[i].length;
    if (len === 0) return false;
    if (len > 4 && i !== groups.length - 1) return false;
  }

  return true;
};
