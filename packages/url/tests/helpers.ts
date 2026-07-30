export const mask = (value: string, character = "*"): string =>
  character.repeat(Array.from(value).length);
