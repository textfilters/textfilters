# PHONE Performance Change

Baseline: `0a799f00630851463b771de7024aa1b1d382368e` (`origin/main`).
The tested branch head is recorded in the pull request. Measurements use the
same Node.js v24.16.0 and npm 11.16.0 installation on one machine. Timings are
milliseconds per public operation, not portable throughput guarantees.

## Reproduction

After `npm ci` and `npm run build` in each checkout, run the existing harness
three times per checkout, alternating baseline and branch:

```sh
npm run benchmark -- phone combined
```

Use the branch's added harness against both built checkouts (five samples per
row). Object construction and history setup are outside steady-state timing:

```sh
node packages/phone/scripts/benchmark-candidates.mjs <baseline-checkout>
node packages/phone/scripts/benchmark-candidates.mjs <branch-checkout>
```

The candidate loop directly counts ASCII digits and skips other ASCII code
points without NFKC, lowercase, array construction, or Unicode range lookup.
Non-ASCII code points still call the unchanged `toRawChar`. The ten-digit
threshold, downstream parsing, case folding at other callers, Unicode ranges,
source coordinates, masks, and false-positive decisions remain unchanged.
Public differential checks compared all four methods on 2,000 deterministic
mixed ASCII/Unicode inputs. The full existing curated fixtures also passed.

## Standard Suites

Each cell is median [minimum, maximum] avg ms across three runs.

| Scenario                                        |                Baseline |             This branch |
| ----------------------------------------------- | ----------------------: | ----------------------: |
| phone · shared filter access                    | 0.0000 [0.0000, 0.0001] | 0.0000 [0.0000, 0.0000] |
| phone · check · short clean                     | 0.0020 [0.0019, 0.0020] | 0.0003 [0.0003, 0.0003] |
| phone · check · long clean                      | 0.2521 [0.2500, 0.2539] | 0.0134 [0.0130, 0.0135] |
| phone · check · short match                     | 0.0088 [0.0087, 0.0089] | 0.0074 [0.0073, 0.0076] |
| phone · check · long match late                 | 0.5423 [0.5392, 0.5535] | 0.3543 [0.3521, 0.3625] |
| phone · find · short match                      | 0.0071 [0.0071, 0.0081] | 0.0060 [0.0059, 0.0061] |
| phone · find · long match late                  | 0.5535 [0.5455, 0.5591] | 0.3767 [0.3692, 0.4002] |
| phone · censor · short clean                    | 0.0010 [0.0010, 0.0012] | 0.0002 [0.0002, 0.0002] |
| phone · censor · long clean                     | 0.2008 [0.1930, 0.2846] | 0.0133 [0.0133, 0.0134] |
| phone · censor · short match                    | 0.0073 [0.0072, 0.0078] | 0.0058 [0.0057, 0.0061] |
| phone · censor · long match late                | 0.5435 [0.5400, 0.5589] | 0.3620 [0.3559, 0.3664] |
| phone · censor · custom mask · short match      | 0.0070 [0.0069, 0.0072] | 0.0057 [0.0056, 0.0058] |
| phone · process · short match                   | 0.0072 [0.0070, 0.0075] | 0.0057 [0.0057, 0.0059] |
| phone · process · long match late               | 0.5807 [0.5595, 0.6046] | 0.3612 [0.3550, 0.3707] |
| combined filter · create                        | 7.9930 [7.7306, 9.1819] | 7.9108 [7.7304, 8.6030] |
| combined · check · short clean                  | 0.0186 [0.0148, 0.0239] | 0.0163 [0.0162, 0.0167] |
| combined · find · short clean                   | 0.0147 [0.0144, 0.0191] | 0.0122 [0.0121, 0.0123] |
| combined · censor · short clean                 | 0.0159 [0.0144, 0.0167] | 0.0140 [0.0121, 0.0144] |
| combined · process · short clean                | 0.0157 [0.0149, 0.0172] | 0.0120 [0.0119, 0.0125] |
| combined · check · long clean                   | 0.9145 [0.9095, 0.9314] | 0.7296 [0.7206, 0.7330] |
| combined · find · long clean                    | 0.9225 [0.9165, 0.9318] | 0.7312 [0.7202, 0.7332] |
| combined · censor · long clean                  | 0.9323 [0.9231, 0.9434] | 0.7329 [0.7291, 0.7574] |
| combined · process · long clean                 | 0.9048 [0.8971, 0.9120] | 0.7197 [0.7082, 0.7442] |
| combined · check · short all-match              | 0.0062 [0.0062, 0.0069] | 0.0062 [0.0061, 0.0064] |
| combined · find · short all-match               | 0.0912 [0.0887, 0.0920] | 0.0865 [0.0857, 0.0878] |
| combined · censor · short all-match             | 0.0879 [0.0868, 0.0884] | 0.0838 [0.0829, 0.0862] |
| combined · process · short all-match            | 0.0875 [0.0865, 0.0883] | 0.0833 [0.0829, 0.0843] |
| combined · check · long match late              | 0.1176 [0.1174, 0.1211] | 0.1180 [0.1167, 0.1276] |
| combined · find · long match late               | 1.7381 [1.7161, 1.7430] | 1.7280 [1.7127, 1.7373] |
| combined · censor · long match late             | 1.7402 [1.7140, 1.7432] | 1.7325 [1.7182, 1.8117] |
| combined · process · long match late            | 1.7194 [1.6974, 1.7210] | 1.7289 [1.7125, 1.7428] |
| combined · check · mixed overlaps               | 0.0046 [0.0045, 0.0048] | 0.0047 [0.0046, 0.0048] |
| combined · find · mixed overlaps                | 0.0667 [0.0650, 0.0676] | 0.0611 [0.0606, 0.0638] |
| combined · censor · mixed overlaps              | 0.0651 [0.0649, 0.0679] | 0.0604 [0.0603, 0.0609] |
| combined · process · mixed overlaps             | 0.0648 [0.0640, 0.0653] | 0.0600 [0.0593, 0.0602] |
| combined · check · cyrillic clean               | 0.0251 [0.0247, 0.0257] | 0.0250 [0.0246, 0.0253] |
| combined · find · cyrillic clean                | 0.0256 [0.0250, 0.0258] | 0.0253 [0.0249, 0.0256] |
| combined · censor · cyrillic clean              | 0.0248 [0.0247, 0.0255] | 0.0251 [0.0250, 0.0260] |
| combined · process · cyrillic clean             | 0.0262 [0.0249, 0.0263] | 0.0240 [0.0238, 0.0257] |
| combined · check · obfuscated                   | 0.0243 [0.0238, 0.0247] | 0.0197 [0.0189, 0.0202] |
| combined · find · obfuscated                    | 0.0311 [0.0310, 0.0312] | 0.0274 [0.0273, 0.0283] |
| combined · censor · obfuscated                  | 0.0310 [0.0308, 0.0311] | 0.0278 [0.0268, 0.0283] |
| combined · process · obfuscated                 | 0.0310 [0.0298, 0.0310] | 0.0266 [0.0263, 0.0270] |
| combined · process · overlapping filter matches | 0.0103 [0.0102, 0.0111] | 0.0103 [0.0100, 0.0107] |
| moderation · allowed · all-match                | 0.0858 [0.0835, 0.0861] | 0.0811 [0.0808, 0.0812] |
| moderation · blocked early · all-match          | 0.0001 [0.0001, 0.0001] | 0.0001 [0.0001, 0.0001] |

## Focused Inputs

Each completed row is median [minimum, maximum] avg ms across five samples.

| Scenario                |                      Baseline |                   This branch |
| ----------------------- | ----------------------------: | ----------------------------: |
| ascii-short-check       | 0.012414 [0.008981, 0.017885] | 0.000781 [0.000592, 0.010072] |
| ascii-short-find        | 0.002217 [0.002165, 0.002328] | 0.000672 [0.000307, 0.000724] |
| ascii-short-censor      | 0.002235 [0.002186, 0.003396] | 0.000389 [0.000333, 0.000569] |
| ascii-short-process     | 0.002233 [0.002189, 0.002282] | 0.000396 [0.000393, 0.000693] |
| ascii-long-check        | 1.721440 [1.706807, 1.727075] | 0.096651 [0.092421, 0.098250] |
| ascii-long-find         | 1.719981 [1.709007, 1.726962] | 0.092629 [0.087542, 0.095072] |
| ascii-long-censor       | 1.717425 [1.702168, 1.722981] | 0.093217 [0.089489, 0.100647] |
| ascii-long-process      | 1.716271 [1.706046, 1.732904] | 0.096642 [0.089478, 0.100837] |
| unicode-long-check      | 2.232011 [2.227557, 2.234967] | 2.006662 [1.979211, 2.025406] |
| unicode-long-find       | 2.232867 [2.225662, 2.242425] | 2.002683 [1.976010, 2.019372] |
| unicode-long-censor     | 2.239592 [2.235118, 2.251342] | 2.015313 [1.993607, 2.031314] |
| unicode-long-process    | 2.236287 [2.227161, 2.248597] | 1.962619 [1.908269, 1.970333] |
| mixed-long-check        | 1.768993 [1.764818, 1.780937] | 1.166931 [1.159267, 1.178675] |
| mixed-long-find         | 1.771603 [1.760014, 1.951167] | 1.171889 [1.157725, 1.181668] |
| mixed-long-censor       | 1.762157 [1.758814, 1.885933] | 1.190915 [1.162381, 1.209657] |
| mixed-long-process      | 1.763156 [1.753186, 1.769399] | 1.195908 [1.179621, 1.218532] |
| below-threshold-check   | 0.751567 [0.747608, 0.780501] | 0.061693 [0.058536, 0.092949] |
| below-threshold-find    | 0.746519 [0.729831, 0.751863] | 0.061790 [0.058517, 0.069689] |
| below-threshold-censor  | 0.733061 [0.727940, 0.756899] | 0.066146 [0.061911, 0.068538] |
| below-threshold-process | 0.729375 [0.728285, 0.751071] | 0.060349 [0.059303, 0.062892] |

## Interpretation and Limits

The repeatable improvement is ASCII candidate screening. Unicode conversion is unchanged; mixed inputs benefit only for their ASCII portion. Ordinary positive-message results and combined rows should be assessed separately from the clean-input fast path.

No standard-suite row exceeded its budget in all three paired runs. Median-only differences are retained in the tables rather than treated as confirmed regressions.
