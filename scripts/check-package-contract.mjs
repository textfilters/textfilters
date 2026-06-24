import { join } from "node:path";
import { checkPackage } from "./package-contract/package-checks.mjs";
import { contract, failures, packagesRoot } from "./package-contract/state.mjs";

for (const pkgSpec of contract.packages) {
  const packageDir = join(packagesRoot, pkgSpec.directory);
  checkPackage(pkgSpec, packageDir);
}

if (failures.length > 0) {
  console.error("Package contract drift detected:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(`Package contract OK for ${contract.packages.length} packages.`);
