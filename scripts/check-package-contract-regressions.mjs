import { expectFail, expectPass } from "./package-contract-regressions/harness.mjs";
import { runCases as runCases01 } from "./package-contract-regressions/cases-01.mjs";
import { runCases as runCases02 } from "./package-contract-regressions/cases-02.mjs";
import { runCases as runCases03 } from "./package-contract-regressions/cases-03.mjs";
import { runCases as runCases04 } from "./package-contract-regressions/cases-04.mjs";
import { runCases as runCases05 } from "./package-contract-regressions/cases-05.mjs";
import { runCases as runCases06 } from "./package-contract-regressions/cases-06.mjs";
import { runCases as runCases07 } from "./package-contract-regressions/cases-07.mjs";

runCases01(expectPass, expectFail);
runCases02(expectPass, expectFail);
runCases03(expectPass, expectFail);
runCases04(expectPass, expectFail);
runCases05(expectPass, expectFail);
runCases06(expectPass, expectFail);
runCases07(expectPass, expectFail);

console.log("Regression contract checks passed.");
