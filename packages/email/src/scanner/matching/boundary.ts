import { type EmailTextMeta } from "../../normalization.js";

export const previousContent = (meta: EmailTextMeta, index: number): string => {
  for (let i = index; i >= 0; i--) {
    if (!meta.zeroWidth[i]) {
      return meta.normalized[i];
    }
  }
  return "";
};

export const nextContent = (meta: EmailTextMeta, index: number): string => {
  for (let i = index; i < meta.normalized.length; i++) {
    if (!meta.zeroWidth[i]) {
      return meta.normalized[i];
    }
  }
  return "";
};
