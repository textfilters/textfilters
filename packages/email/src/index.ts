export { createEmailFilter, emailFilter, filter } from "./filter.js";
export {
  EMAIL_FILTER_NAME,
  type EmailRangeMatch,
  type EmailRangeMatchSink,
  type EmailRangeScanner,
  type EmailRangeScanResult,
  type EmailFilter,
  type EmailFilterOptions,
  type EmailScanHints,
  type EmailScanInput,
} from "./types.js";
export {
  checkEmailRanges,
  collectEmailRanges,
  createEmailScanner,
  scanEmailRangeMatches,
  scanEmailRanges,
  type EmailScannerConfig,
} from "./scanner.js";
