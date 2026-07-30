export const readEscapeAtom = (
  source: string,
  start: number,
): [string, number] => {
  const next = source[start + 1];
  if (next === undefined) {
    return ["\\", start + 1];
  }

  // Property and braced Unicode escapes must stay as one atom; splitting them
  // would make the loose transformer insert separators inside regexp syntax.
  if ((next === "p" || next === "P") && source[start + 2] === "{") {
    const end = source.indexOf("}", start + 3);
    if (end !== -1) {
      return [source.slice(start, end + 1), end + 1];
    }
  }

  if (next === "u" && source[start + 2] === "{") {
    const end = source.indexOf("}", start + 3);
    if (end !== -1) {
      return [source.slice(start, end + 1), end + 1];
    }
  }

  const end = Math.min(source.length, start + 2);
  return [source.slice(start, end), end];
};

export const readBalanced = (
  source: string,
  start: number,
  open: string,
  close: string,
): [string, number] => {
  // Groups and classes can contain escaped delimiters, so a plain indexOf would
  // split valid controlled rules in the wrong segment.
  let depth = 0;
  let escaped = false;

  for (let index = start; index < source.length; index += 1) {
    const char = source[index];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === "\\") {
      escaped = true;
      continue;
    }

    if (char === open) {
      depth += 1;
    } else if (char === close) {
      depth -= 1;
      if (depth === 0) {
        return [source.slice(start, index + 1), index + 1];
      }
    }
  }

  return [source.slice(start), source.length];
};

export const readQuantifier = (
  source: string,
  start: number,
): [string, number] => {
  const char = source[start];
  if (char === undefined) {
    return ["", start];
  }

  if (char === "?" || char === "*" || char === "+") {
    const lazy = source[start + 1] === "?" ? "?" : "";
    return [char + lazy, start + 1 + lazy.length];
  }

  if (char === "{") {
    const end = source.indexOf("}", start + 1);
    if (end !== -1) {
      const lazy = source[end + 1] === "?" ? "?" : "";
      return [source.slice(start, end + 1) + lazy, end + 1 + lazy.length];
    }
  }

  return ["", start];
};

export const splitTopLevelAlternatives = (source: string): string[] => {
  const alternatives: string[] = [];
  let start = 0;
  let depth = 0;
  let inClass = false;
  let escaped = false;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === "\\") {
      escaped = true;
      continue;
    }

    if (inClass) {
      if (char === "]") {
        inClass = false;
      }
      continue;
    }

    if (char === "[") {
      inClass = true;
      continue;
    }

    if (char === "(") {
      depth += 1;
      continue;
    }

    if (char === ")") {
      depth = Math.max(0, depth - 1);
      continue;
    }

    if (char === "|" && depth === 0) {
      alternatives.push(source.slice(start, index));
      start = index + 1;
    }
  }

  alternatives.push(source.slice(start));
  return alternatives;
};
