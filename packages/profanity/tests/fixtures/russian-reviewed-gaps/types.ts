export interface ReviewedGapAuditCase {
  readonly family: string;
  readonly input: string;
  readonly note: string;
}

export interface ReviewedGapMetadataCase {
  readonly input: string;
  readonly expected: {
    readonly ruleId: string;
    readonly category: string;
    readonly severity: string;
  };
}
