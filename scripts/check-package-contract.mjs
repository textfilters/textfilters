import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoDir = resolve(scriptDir, "..");
const contractPath = join(repoDir, "package-contract.json");
const contract = readJson(contractPath);
const packagesRoot = resolve(repoDir, contract.packagesRoot);
const failures = [];

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

function checkPackage(pkgSpec, packageDir) {
  const label = pkgSpec.directory;
  const packageJsonPath = join(packageDir, "package.json");
  const releaseConfigPath = join(packageDir, "release-please-config.json");
  const checkWorkflowPath = join(packageDir, contract.checkWorkflow.path);
  const releaseWorkflowPath = join(packageDir, contract.releaseWorkflow.path);

  if (!existsSync(packageJsonPath)) {
    fail(label, "missing package.json");
    return;
  }

  const pkg = readJson(packageJsonPath);
  expectEqual(label, "package name", pkg.name, pkgSpec.name);
  expectEqual(label, "type", pkg.type, contract.manifest.type);
  expectEqual(label, "license", pkg.license, contract.manifest.license);
  expectEqual(label, "sideEffects", pkg.sideEffects, contract.manifest.sideEffects);
  expectEqual(label, "engines.node", pkg.engines?.node, contract.manifest.engines.node);
  expectEqual(label, "packageManager", pkg.packageManager, contract.manifest.packageManager);
  expectEqual(
    label,
    "publishConfig.registry",
    pkg.publishConfig?.registry,
    contract.manifest.publishConfig.registry,
  );

  for (const file of contract.manifest.requiredFiles) {
    if (!Array.isArray(pkg.files) || !pkg.files.includes(file)) {
      fail(label, `package files must include ${file}`);
    }
  }

  for (const scriptName of contract.manifest.requiredScriptNames) {
    if (typeof pkg.scripts?.[scriptName] !== "string") {
      fail(label, `missing script ${scriptName}`);
    }
  }

  for (const [scriptName, expected] of Object.entries(contract.manifest.requiredScripts)) {
    expectEqual(label, `script ${scriptName}`, pkg.scripts?.[scriptName], expected);
  }

  for (const fragment of contract.manifest.checkScriptMustInclude) {
    if (!pkg.scripts?.check?.includes(fragment)) {
      fail(label, `check script must include ${fragment}`);
    }
  }

  for (const [dependency, expected] of Object.entries(contract.manifest.commonDevDependencies)) {
    expectEqual(label, `devDependency ${dependency}`, pkg.devDependencies?.[dependency], expected);
  }

  const allowedExtraDevDependencies = new Set(pkgSpec.allowedExtraDevDependencies ?? []);
  for (const dependency of Object.keys(pkg.devDependencies ?? {})) {
    if (
      !(dependency in contract.manifest.commonDevDependencies) &&
      !allowedExtraDevDependencies.has(dependency)
    ) {
      fail(label, `unexpected devDependency ${dependency}`);
    }
  }

  if (pkgSpec.dependsOnCore) {
    expectEqual(
      label,
      "dependency @textfilters/core",
      pkg.dependencies?.["@textfilters/core"],
      contract.manifest.coreDependencyRange,
    );
  } else if (pkg.dependencies?.["@textfilters/core"]) {
    fail(label, "core package must not depend on @textfilters/core");
  }

  checkWorkflow(label, checkWorkflowPath);
  checkReleaseWorkflow(label, releaseWorkflowPath);
  checkReleaseConfig(label, releaseConfigPath, pkgSpec.name);
}

function checkWorkflow(label, workflowPath) {
  const workflow = readText(label, workflowPath);
  if (!workflow) return;

  expectText(label, workflowPath, workflow, `name: ${contract.checkWorkflow.name}`);
  expectText(label, workflowPath, workflow, "pull_request:");
  expectText(label, workflowPath, workflow, "push:");
  expectText(label, workflowPath, workflow, "- main");
  expectText(label, workflowPath, workflow, "contents: read");
  expectText(label, workflowPath, workflow, "packages: read");
  expectText(label, workflowPath, workflow, `uses: ${contract.checkWorkflow.checkoutAction}`);
  expectText(label, workflowPath, workflow, `uses: ${contract.checkWorkflow.setupNodeAction}`);
  expectText(label, workflowPath, workflow, `node-version: ${contract.checkWorkflow.nodeVersion}`);
  expectText(label, workflowPath, workflow, `registry-url: ${contract.checkWorkflow.registryUrl}`);
  expectText(label, workflowPath, workflow, `scope: "${contract.checkWorkflow.scope}"`);
  expectText(label, workflowPath, workflow, "NODE_AUTH_TOKEN: ${{ github.token }}");
  expectText(label, workflowPath, workflow, `run: ${contract.checkWorkflow.installCommand}`);
  expectText(label, workflowPath, workflow, `run: ${contract.checkWorkflow.checkCommand}`);
}

function checkReleaseWorkflow(label, workflowPath) {
  const workflow = readText(label, workflowPath);
  if (!workflow) return;

  expectText(label, workflowPath, workflow, `name: ${contract.releaseWorkflow.name}`);
  expectText(label, workflowPath, workflow, "push:");
  expectText(label, workflowPath, workflow, "- main");
  expectText(label, workflowPath, workflow, "contents: read");
  expectText(label, workflowPath, workflow, "contents: write");
  expectText(label, workflowPath, workflow, "issues: write");
  expectText(label, workflowPath, workflow, "pull-requests: write");
  expectText(label, workflowPath, workflow, `uses: ${contract.releaseWorkflow.releaseAction}`);
  expectText(label, workflowPath, workflow, `token: ${contract.releaseWorkflow.token}`);
  expectText(label, workflowPath, workflow, `config-file: ${contract.releaseWorkflow.configFile}`);
  expectText(label, workflowPath, workflow, `manifest-file: ${contract.releaseWorkflow.manifestFile}`);
  expectText(label, workflowPath, workflow, `uses: ${contract.checkWorkflow.checkoutAction}`);
  expectText(label, workflowPath, workflow, `uses: ${contract.checkWorkflow.setupNodeAction}`);
  expectText(label, workflowPath, workflow, `node-version: ${contract.checkWorkflow.nodeVersion}`);
  expectText(label, workflowPath, workflow, `registry-url: ${contract.checkWorkflow.registryUrl}`);
  expectText(label, workflowPath, workflow, `scope: "${contract.checkWorkflow.scope}"`);
  expectText(label, workflowPath, workflow, "NODE_AUTH_TOKEN: ${{ github.token }}");
  expectText(label, workflowPath, workflow, `run: ${contract.checkWorkflow.installCommand}`);
  expectText(label, workflowPath, workflow, `run: ${contract.checkWorkflow.checkCommand}`);
  expectText(label, workflowPath, workflow, `run: ${contract.releaseWorkflow.publishCommand}`);
}

function checkReleaseConfig(label, releaseConfigPath, packageName) {
  if (!existsSync(releaseConfigPath)) {
    fail(label, "missing release-please-config.json");
    return;
  }

  const config = readJson(releaseConfigPath);
  expectEqual(
    label,
    "release-please include-component-in-tag",
    config["include-component-in-tag"],
    contract.releasePleaseConfig.includeComponentInTag,
  );
  expectEqual(
    label,
    "release-please package release-type",
    config.packages?.["."]?.["release-type"],
    contract.releasePleaseConfig.releaseType,
  );
  expectEqual(
    label,
    "release-please package name",
    config.packages?.["."]?.["package-name"],
    packageName,
  );
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function readText(label, path) {
  if (!existsSync(path)) {
    fail(label, `missing ${relativePackagePath(path)}`);
    return "";
  }
  return readFileSync(path, "utf8");
}

function expectEqual(label, name, actual, expected) {
  if (actual !== expected) {
    fail(label, `${name} expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function expectText(label, path, text, expected) {
  if (!text.includes(expected)) {
    fail(label, `${relativePackagePath(path)} must include ${expected}`);
  }
}

function fail(label, message) {
  failures.push(`${label}: ${message}`);
}

function relativePackagePath(path) {
  return path.startsWith(packagesRoot)
    ? path.slice(packagesRoot.length + 1)
    : path.slice(repoDir.length + 1);
}
