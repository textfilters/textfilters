# URL Performance Change

Baseline: `0a799f00630851463b771de7024aa1b1d382368e` (`origin/main`).
The tested branch head is recorded in the pull request. Measurements use the
same Node.js v24.16.0 and npm 11.16.0 installation on one machine. Timings are
milliseconds per public operation, not portable throughput guarantees.

## Reproduction

After `npm ci` and `npm run build` in each checkout, run the existing harness
three times per checkout, alternating baseline and branch:

```sh
npm run benchmark -- url combined
```

Use the branch's added harness against both built checkouts (five samples per
row). Object construction and history setup are outside steady-state timing:

```sh
node packages/url/scripts/benchmark-candidates.mjs <baseline-checkout>
node packages/url/scripts/benchmark-candidates.mjs <branch-checkout>
```

For bounded baseline execution, pass a row label such as `ascii-16000` as the
second argument and use an isolated process with a 15-second timeout. Rows that
exceeded that budget are reported as timeouts, not estimated measurements. An
initial combined baseline invocation exceeded 90 seconds and was replaced by
these per-row processes using the same harness on both sides.

The public filter reproduces repeated left/right scans on neutral separator
runs. No candidate reaches parser metadata on these inputs. The forward pass
and disjoint selector lookahead in `hasLikelyDomainDot` each inspect at most n
code points; there is no relocated nearest-letter scan. See
[the pass analysis](architecture.md#domain-dot-candidate-pass). This establishes
linearity of the changed prefilter only, not of the entire URL parser.

Public differential checks covered 2,000 deterministic mixed-symbol inputs and
all four methods; 80,000 additional internal decisions covered ASCII, Unicode,
and both ambiguous-space policies. Existing ranges, masks, allowlists, TLD
policies, early exits, and parser behavior remain unchanged.

## Standard Suites

Each cell is median [minimum, maximum] avg ms across three runs.

| Scenario                                        |                Baseline |             This branch |
| ----------------------------------------------- | ----------------------: | ----------------------: |
| url · createUrlFilter()                         | 0.0003 [0.0003, 0.0003] | 0.0003 [0.0002, 0.0003] |
| url · check · short clean                       | 0.0009 [0.0009, 0.0010] | 0.0011 [0.0009, 0.0012] |
| url · check · long clean                        | 0.0228 [0.0223, 0.0229] | 0.0233 [0.0232, 0.0237] |
| url · check · short match                       | 0.0038 [0.0037, 0.0040] | 0.0037 [0.0036, 0.0037] |
| url · check · long match late                   | 0.1491 [0.1481, 0.1539] | 0.1492 [0.1473, 0.1503] |
| url · find · short match                        | 0.0031 [0.0030, 0.0033] | 0.0031 [0.0030, 0.0031] |
| url · find · long match late                    | 0.1526 [0.1522, 0.1534] | 0.1557 [0.1522, 0.1571] |
| url · censor · short clean                      | 0.0004 [0.0004, 0.0005] | 0.0005 [0.0004, 0.0005] |
| url · censor · long clean                       | 0.0225 [0.0222, 0.0229] | 0.0233 [0.0226, 0.0239] |
| url · censor · short match                      | 0.0029 [0.0029, 0.0029] | 0.0031 [0.0028, 0.0035] |
| url · censor · long match late                  | 0.1535 [0.1508, 0.1544] | 0.1547 [0.1535, 0.1604] |
| url · censor · custom mask · short match        | 0.0025 [0.0025, 0.0026] | 0.0029 [0.0025, 0.0067] |
| url · process · short match                     | 0.0026 [0.0026, 0.0029] | 0.0028 [0.0027, 0.0040] |
| url · process · long match late                 | 0.1499 [0.1487, 0.1509] | 0.1555 [0.1526, 0.1557] |
| combined filter · create                        | 7.7367 [7.7275, 7.7575] | 7.8243 [7.4980, 8.0390] |
| combined · check · short clean                  | 0.0185 [0.0185, 0.0190] | 0.0191 [0.0159, 0.0197] |
| combined · find · short clean                   | 0.0174 [0.0168, 0.0176] | 0.0174 [0.0153, 0.0182] |
| combined · censor · short clean                 | 0.0147 [0.0141, 0.0156] | 0.0160 [0.0146, 0.0169] |
| combined · process · short clean                | 0.0160 [0.0155, 0.0162] | 0.0150 [0.0145, 0.0155] |
| combined · check · long clean                   | 0.9498 [0.9400, 0.9670] | 0.9558 [0.9471, 0.9573] |
| combined · find · long clean                    | 0.9627 [0.9533, 0.9821] | 0.9608 [0.9528, 0.9628] |
| combined · censor · long clean                  | 0.9523 [0.9508, 0.9618] | 0.9590 [0.9494, 0.9638] |
| combined · process · long clean                 | 0.9403 [0.9323, 0.9418] | 0.9359 [0.9327, 0.9361] |
| combined · check · short all-match              | 0.0063 [0.0062, 0.0063] | 0.0061 [0.0060, 0.0064] |
| combined · find · short all-match               | 0.0902 [0.0887, 0.0911] | 0.0902 [0.0893, 0.0936] |
| combined · censor · short all-match             | 0.0869 [0.0867, 0.0871] | 0.0876 [0.0872, 0.0880] |
| combined · process · short all-match            | 0.0861 [0.0853, 0.0874] | 0.0871 [0.0862, 0.0896] |
| combined · check · long match late              | 0.1159 [0.1154, 0.1169] | 0.1170 [0.1151, 0.1180] |
| combined · find · long match late               | 1.7058 [1.6953, 1.7245] | 1.7332 [1.7279, 1.7427] |
| combined · censor · long match late             | 1.7321 [1.7186, 1.7609] | 1.7330 [1.7324, 1.7491] |
| combined · process · long match late            | 1.7030 [1.6933, 1.7238] | 1.7299 [1.6965, 1.7313] |
| combined · check · mixed overlaps               | 0.0046 [0.0045, 0.0047] | 0.0047 [0.0046, 0.0050] |
| combined · find · mixed overlaps                | 0.0657 [0.0642, 0.0664] | 0.0672 [0.0665, 0.0690] |
| combined · censor · mixed overlaps              | 0.0640 [0.0638, 0.0644] | 0.0652 [0.0631, 0.0653] |
| combined · process · mixed overlaps             | 0.0639 [0.0628, 0.0644] | 0.0644 [0.0634, 0.0666] |
| combined · check · cyrillic clean               | 0.0252 [0.0251, 0.0260] | 0.0260 [0.0249, 0.0265] |
| combined · find · cyrillic clean                | 0.0251 [0.0249, 0.0258] | 0.0258 [0.0252, 0.0267] |
| combined · censor · cyrillic clean              | 0.0257 [0.0254, 0.0275] | 0.0259 [0.0255, 0.0261] |
| combined · process · cyrillic clean             | 0.0260 [0.0257, 0.0263] | 0.0259 [0.0259, 0.0268] |
| combined · check · obfuscated                   | 0.0226 [0.0225, 0.0234] | 0.0266 [0.0252, 0.0298] |
| combined · find · obfuscated                    | 0.0304 [0.0301, 0.0307] | 0.0317 [0.0317, 0.0325] |
| combined · censor · obfuscated                  | 0.0294 [0.0294, 0.0300] | 0.0315 [0.0313, 0.0330] |
| combined · process · obfuscated                 | 0.0303 [0.0294, 0.0308] | 0.0314 [0.0311, 0.0328] |
| combined · process · overlapping filter matches | 0.0108 [0.0106, 0.0112] | 0.0105 [0.0103, 0.0110] |
| moderation · allowed · all-match                | 0.0829 [0.0828, 0.0830] | 0.0855 [0.0849, 0.0935] |
| moderation · blocked early · all-match          | 0.0001 [0.0001, 0.0001] | 0.0001 [0.0001, 0.0001] |

## Focused Inputs

Each completed row is median [minimum, maximum] avg ms across five samples.

| Scenario        |                               Baseline |                   This branch |
| --------------- | -------------------------------------: | ----------------------------: |
| ascii-1000      |          0.869125 [0.868875, 0.877209] | 0.041542 [0.035166, 0.048333] |
| ascii-2000      |          2.526000 [2.510125, 2.527834] | 0.035000 [0.034500, 0.045167] |
| ascii-4000      |        10.191083 [9.234417, 10.604250] | 0.070625 [0.067208, 0.337584] |
| ascii-8000      |       35.768166 [33.463000, 37.700000] | 0.070291 [0.068583, 0.323583] |
| ascii-16000     |    133.879250 [130.322209, 138.010458] | 0.124833 [0.121458, 0.145708] |
| unicode-1000    |       12.423125 [12.353500, 12.456958] | 0.098875 [0.079000, 0.307875] |
| unicode-2000    |       49.927334 [49.517333, 53.888875] | 0.187792 [0.147083, 0.217125] |
| unicode-4000    |    197.471541 [197.100209, 198.423917] | 0.277250 [0.252750, 0.575542] |
| unicode-8000    |    798.986375 [795.584375, 810.437625] | 0.572833 [0.516166, 0.632000] |
| unicode-16000   |             timeout (15 s per process) | 1.267209 [1.068417, 1.315834] |
| selectors-1000  |       15.901375 [15.525708, 16.228458] | 0.169916 [0.130750, 0.360208] |
| selectors-2000  |       61.728167 [61.631666, 62.231917] | 0.293834 [0.267792, 0.365792] |
| selectors-4000  |    249.595958 [247.932834, 249.970375] | 0.544417 [0.505500, 0.641542] |
| selectors-8000  | 1008.482875 [1002.176834, 1011.786292] | 1.073750 [1.006500, 1.093583] |
| selectors-16000 |             timeout (15 s per process) | 2.228750 [2.205792, 2.622667] |

## Interpretation and Limits

Long neutral separator inputs improve substantially and the new scaling is consistent with the pass analysis. Microsecond-scale short rows and unchanged combined rows remain noisy; no whole-parser or general combined speedup is claimed.

No standard-suite row exceeded its budget in all three paired runs. Median-only differences are retained in the tables rather than treated as confirmed regressions.
