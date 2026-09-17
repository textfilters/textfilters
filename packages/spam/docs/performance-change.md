# SPAM Performance Change

Baseline: `0a799f00630851463b771de7024aa1b1d382368e` (`origin/main`).
The tested branch head is recorded in the pull request. Measurements use the
same Node.js v24.16.0 and npm 11.16.0 installation on one machine. Timings are
milliseconds per public operation, not portable throughput guarantees.

## Reproduction

After `npm ci` and `npm run build` in each checkout, run the existing harness
three times per checkout, alternating baseline and branch:

```sh
npm run benchmark -- spam combined
```

Use the branch's added harness against both built checkouts (five samples per
row). Object construction and history setup are outside steady-state timing:

```sh
node packages/spam/scripts/benchmark-candidates.mjs <baseline-checkout>
node packages/spam/scripts/benchmark-candidates.mjs <branch-checkout>
```

This is a correctness fix, not a claim of faster long-message processing.
Previously `"x".repeat(512) + "a"` and the same prefix plus `"b"` were duplicates
with interval and burst interference disabled. Full normalization now preserves
the difference. Long keys use portable synchronous SHA-256 over exact UTF-16LE;
short keys remain literal. See [the comparison design](architecture.md#full-message-duplicate-keys)
for collision risk, surrogate preservation, and retained-memory bounds.

Full-message hashing adds O(n) work that the old prefix comparison omitted.
Normalization still uses O(n) transient memory, while history keys remain
bounded independently of message length. Tests inspect retained keys after
hundreds of long messages and actor churn; timing rows do not measure heap use.
All existing interval/duplicate/burst ordering, rejected-attempt, clock, reset,
and capacity tests remain enabled.

## Standard Suites

Each cell is median [minimum, maximum] avg ms across three runs.

| Scenario                                        |                Baseline |             This branch |
| ----------------------------------------------- | ----------------------: | ----------------------: |
| spam · createSpamGuard()                        | 0.0004 [0.0004, 0.0004] | 0.0003 [0.0003, 0.0004] |
| spam · check · allowed · short                  | 0.0013 [0.0012, 0.0014] | 0.0012 [0.0012, 0.0012] |
| spam · check · tooFast block                    | 0.0002 [0.0002, 0.0002] | 0.0002 [0.0002, 0.0002] |
| spam · check · duplicate block                  | 0.0004 [0.0004, 0.0004] | 0.0005 [0.0005, 0.0006] |
| spam · check · burst block                      | 0.0007 [0.0006, 0.0007] | 0.0004 [0.0004, 0.0004] |
| spam · check · tooFast · full history           | 0.0002 [0.0002, 0.0002] | 0.0002 [0.0002, 0.0002] |
| spam · check · actor capacity churn             | 0.0219 [0.0216, 0.0222] | 0.0216 [0.0215, 0.0220] |
| spam · check · bounded history accepted         | 0.0163 [0.0162, 0.0170] | 0.0194 [0.0191, 0.0198] |
| combined filter · create                        | 7.8373 [7.7007, 7.9441] | 7.6843 [7.4145, 7.9763] |
| combined · check · short clean                  | 0.0156 [0.0148, 0.0198] | 0.0186 [0.0150, 0.0188] |
| combined · find · short clean                   | 0.0186 [0.0177, 0.0187] | 0.0150 [0.0145, 0.0181] |
| combined · censor · short clean                 | 0.0161 [0.0147, 0.0165] | 0.0162 [0.0160, 0.0166] |
| combined · process · short clean                | 0.0149 [0.0149, 0.0154] | 0.0143 [0.0142, 0.0157] |
| combined · check · long clean                   | 0.9775 [0.9530, 0.9943] | 0.9574 [0.9490, 0.9603] |
| combined · find · long clean                    | 0.9796 [0.9575, 0.9852] | 0.9531 [0.9493, 0.9603] |
| combined · censor · long clean                  | 0.9689 [0.9665, 0.9750] | 0.9577 [0.9559, 0.9791] |
| combined · process · long clean                 | 0.9510 [0.9484, 1.0168] | 0.9411 [0.9359, 0.9554] |
| combined · check · short all-match              | 0.0064 [0.0061, 0.0064] | 0.0063 [0.0061, 0.0066] |
| combined · find · short all-match               | 0.0911 [0.0906, 0.0957] | 0.0927 [0.0888, 0.0935] |
| combined · censor · short all-match             | 0.0868 [0.0866, 0.0894] | 0.0875 [0.0870, 0.0898] |
| combined · process · short all-match            | 0.0850 [0.0849, 0.0875] | 0.0861 [0.0859, 0.0879] |
| combined · check · long match late              | 0.1162 [0.1157, 0.1169] | 0.1164 [0.1161, 0.1204] |
| combined · find · long match late               | 1.7138 [1.7086, 1.8212] | 1.7632 [1.7559, 2.0658] |
| combined · censor · long match late             | 1.7428 [1.7382, 1.9243] | 1.7623 [1.7388, 1.9031] |
| combined · process · long match late            | 1.6974 [1.6931, 1.7585] | 1.7633 [1.7095, 2.2132] |
| combined · check · mixed overlaps               | 0.0046 [0.0043, 0.0048] | 0.0046 [0.0046, 0.0051] |
| combined · find · mixed overlaps                | 0.0665 [0.0662, 0.0681] | 0.0677 [0.0672, 0.0712] |
| combined · censor · mixed overlaps              | 0.0653 [0.0646, 0.0663] | 0.0664 [0.0656, 0.0697] |
| combined · process · mixed overlaps             | 0.0655 [0.0653, 0.0657] | 0.0659 [0.0646, 0.0775] |
| combined · check · cyrillic clean               | 0.0252 [0.0251, 0.0267] | 0.0264 [0.0257, 0.0326] |
| combined · find · cyrillic clean                | 0.0255 [0.0251, 0.0257] | 0.0260 [0.0256, 0.0270] |
| combined · censor · cyrillic clean              | 0.0248 [0.0248, 0.0256] | 0.0256 [0.0244, 0.0268] |
| combined · process · cyrillic clean             | 0.0256 [0.0254, 0.0258] | 0.0253 [0.0247, 0.0268] |
| combined · check · obfuscated                   | 0.0240 [0.0238, 0.0252] | 0.0246 [0.0237, 0.0275] |
| combined · find · obfuscated                    | 0.0304 [0.0303, 0.0306] | 0.0317 [0.0299, 0.0334] |
| combined · censor · obfuscated                  | 0.0312 [0.0302, 0.0319] | 0.0311 [0.0310, 0.0329] |
| combined · process · obfuscated                 | 0.0304 [0.0302, 0.0307] | 0.0311 [0.0305, 0.0323] |
| combined · process · overlapping filter matches | 0.0103 [0.0103, 0.0109] | 0.0110 [0.0105, 0.0111] |
| moderation · allowed · all-match                | 0.0858 [0.0834, 0.0879] | 0.0853 [0.0838, 0.1004] |
| moderation · blocked early · all-match          | 0.0001 [0.0001, 0.0001] | 0.0001 [0.0001, 0.0001] |

## Focused Inputs

Each completed row is median [minimum, maximum] avg ms across five samples.

| Scenario               |                      Baseline |                   This branch |
| ---------------------- | ----------------------------: | ----------------------------: |
| duplicate-20           | 0.000700 [0.000548, 0.002880] | 0.001020 [0.000703, 0.005467] |
| accepted-20            | 0.000838 [0.000632, 0.003167] | 0.000818 [0.000684, 0.002328] |
| duplicate-512          | 0.001224 [0.001216, 0.001383] | 0.001418 [0.001306, 0.002014] |
| accepted-512           | 0.001251 [0.001250, 0.001800] | 0.001308 [0.001299, 0.001912] |
| duplicate-513          | 0.001159 [0.001153, 0.001618] | 0.006612 [0.006396, 0.021800] |
| accepted-513           | 0.001242 [0.001207, 0.001595] | 0.006108 [0.005573, 0.007241] |
| duplicate-16000        | 0.007928 [0.007634, 0.008066] | 0.133961 [0.130703, 0.136215] |
| accepted-16000         | 0.007723 [0.007517, 0.009152] | 0.132004 [0.130260, 0.133764] |
| duplicate-64000        | 0.027497 [0.025973, 0.028436] | 0.515995 [0.508974, 0.528874] |
| accepted-64000         | 0.026101 [0.025967, 0.029375] | 0.518147 [0.506737, 0.522850] |
| duplicate-full-history | 0.020684 [0.019540, 0.023807] | 0.143066 [0.142029, 0.148087] |

## Interpretation and Limits

Long-message rows intentionally regress because every normalized code unit is now hashed instead of comparing a 512-unit prefix. The 513-unit transition adds hashing cost. Short-message rows retain literal comparison; sub-microsecond differences and unchanged combined-filter rows are noisy and are not presented as speedups.

Rows exceeding their budget in all three paired runs are retained for review:

- `spam · check · duplicate block`: 0.0004 [0.0004, 0.0004] to 0.0005 [0.0005, 0.0006] avg ms.

The short duplicate-block row rose from 0.0004 to 0.0005 avg ms (25% in the
rounded median, about 0.1 microseconds). This repeated small regression is
retained as a tradeoff for unambiguous literal/digest key namespaces, which add
per-check string work. It is not hidden by the long-message correctness gain.
No other standard-suite row exceeded its budget in all three paired runs.
