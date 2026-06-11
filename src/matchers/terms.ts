export const normalizeTermList = (list: unknown): string[] => {
  if (!Array.isArray(list)) {
    return [];
  }

  const seen = new Set<string>();
  const terms: string[] = [];

  for (const item of list) {
    const term = normalizeTermValue(item);
    if (term === null || seen.has(term)) {
      continue;
    }

    seen.add(term);
    terms.push(term);
  }

  return terms;
};

const normalizeTermValue = (term: unknown): string | null => {
  const value = String(term ?? "").trim();
  return value.length > 0 ? value : null;
};
