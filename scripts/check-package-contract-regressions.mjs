import { copyFileSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const sourceRepo = dirname(dirname(fileURLToPath(import.meta.url)));
const root = mkdtempSync(join(tmpdir(), "textfilters-contract-regression-"));
const scriptPath = join(root, "scripts", "check-package-contract.mjs");
let fixtureIndex = 0;

mkdirSync(dirname(scriptPath), { recursive: true });
copyFileSync(join(sourceRepo, "scripts", "check-package-contract.mjs"), scriptPath);

expectPass("valid fixture");
expectFail("argv-style child_process publish", (state) => {
  state.extraWorkflow = `name: Manual Publish

on:
  workflow_dispatch:

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - run: node -e "require('child_process').spawnSync('npm', ['publish', '--registry=https://npm.pkg.github.com'])"
`;
}, "manual-publish.yml must not use child_process command execution");
expectFail("multiline npm wrapper function", (state) => {
  state.extraWorkflow = `name: Manual Publish

on:
  workflow_dispatch:

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - run: |
          n() {
            npm "$@"
          }
          n publish --registry=https://npm.pkg.github.com
`;
}, "manual-publish.yml must not define shell functions");
expectFail("pipeline no-op delegated script", (state) => {
  state.packageJson.scripts.test = "true | cat";
}, "script test must not use shell pipelines");
expectFail("npm exec shell snippet", (state) => {
  state.extraWorkflow = `name: Manual Publish

on:
  workflow_dispatch:

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - run: npm x -c "npm publish --registry=https://npm.pkg.github.com"
`;
}, "manual-publish.yml must not use npm exec");
expectFail("npm package manifest mutation", (state) => {
  state.packageJson.scripts.lint =
    "npm pkg set scripts.prepublishOnly='node ./hook.mjs' && prettier . --check";
}, "script lint must not mutate package.json");
expectFail("node preload module scan", (state) => {
  state.packageJson.scripts["smoke:dist"] = "npm run build && node --require ./hook.cjs -e ''";
  state.files = {
    "hook.cjs": "require('node:fs').appendFileSync('.npmrc', 'dry-run=true\\n');\n",
  };
}, "script smoke:dist referenced file");
expectFail("command substitution command word", (state) => {
  state.extraWorkflow = `name: Manual Publish

on:
  workflow_dispatch:

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - run: '"$(printf npm)" publish --registry=https://npm.pkg.github.com'
`;
}, "manual-publish.yml must not use shell command substitution");
expectFail("variable npmrc redirection target", (state) => {
  state.packageJson.scripts.lint = "p=.npmrc; printf 'dry-run=true\\n' > \"$p\"; prettier . --check";
}, "script lint must not write npm config files");
expectFail("block scalar uses action", (state) => {
  state.extraWorkflow = `name: Manual Release

on:
  workflow_dispatch:

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: >-
          googleapis/release-please-action@v5
`;
}, "manual-publish.yml must not include googleapis/release-please-action@v5");
expectFail("local script dependency mutation", (state) => {
  state.packageJson.scripts["smoke:dist"] = "npm run build && node smoke.mjs";
  state.files = {
    "smoke.mjs": "import './hook.mjs';\n",
    "hook.mjs": "import { appendFileSync } from 'node:fs';\nappendFileSync('.npmrc', 'dry-run=true\\n');\n",
  };
}, "script smoke:dist referenced file");
expectFail("npx exec wrapper", (state) => {
  state.extraWorkflow = `name: Manual Publish

on:
  workflow_dispatch:

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - run: npx -c "npm publish --registry=https://npm.pkg.github.com"
`;
}, "manual-publish.yml must not use npm exec");
expectFail("variable npx exec wrapper", (state) => {
  state.packageJson.scripts.lint = "x=npx; $x -c 'npm publish --registry=https://npm.pkg.github.com'";
}, "script lint must not use npm exec");
expectFail("re-exported local script dependency", (state) => {
  state.packageJson.scripts["smoke:dist"] = "npm run build && node smoke.mjs";
  state.files = {
    "smoke.mjs": "export * from './hook.mjs';\n",
    "hook.mjs": "import { appendFileSync } from 'node:fs';\nappendFileSync('.npmrc', 'dry-run=true\\n');\n",
  };
}, "script smoke:dist referenced file");
expectFail("npm conf set mutation", (state) => {
  state.packageJson.scripts.lint = "npm conf set dry-run=true && prettier . --check";
}, "script lint must not write publish-altering npm config");
expectFail("delegated script short-circuit", (state) => {
  state.packageJson.scripts.test = "echo ok || vitest run";
}, "script test must not short-circuit delegated work");
expectFail("NODE_OPTIONS preload module scan", (state) => {
  state.packageJson.scripts["smoke:dist"] =
    "npm run build && NODE_OPTIONS=--require=./hook.cjs node smoke.mjs";
  state.files = {
    "hook.cjs": "require('node:fs').appendFileSync('.npmrc', 'dry-run=true\\n');\n",
  };
}, "script smoke:dist referenced file");
expectFail("variable NODE_OPTIONS preload module scan", (state) => {
  state.packageJson.scripts["smoke:dist"] =
    "npm run build && opts=--require=./hook.cjs; NODE_OPTIONS=$opts node smoke.mjs";
  state.files = {
    "hook.cjs": "require('node:fs').appendFileSync('.npmrc', 'dry-run=true\\n');\n",
  };
}, "script smoke:dist referenced file");
expectFail("indirect JavaScript npmrc write", (state) => {
  state.packageJson.scripts["smoke:dist"] = "npm run build && node smoke.mjs";
  state.files = {
    "smoke.mjs": "import { appendFileSync } from 'node:fs';\nconst p = '.npmrc';\nappendFileSync(p, 'dry-run=true\\n');\n",
  };
}, "script smoke:dist referenced file");
expectFail("path-qualified local interpreter", (state) => {
  state.packageJson.scripts["smoke:dist"] = "npm run build && /usr/bin/node smoke.mjs";
  state.files = {
    "smoke.mjs": "import { appendFileSync } from 'node:fs';\nappendFileSync('.npmrc', 'dry-run=true\\n');\n",
  };
}, "script smoke:dist referenced file");
expectFail("old lockfile version with packages map", (state) => {
  state.packageLock = `${JSON.stringify(
    {
      lockfileVersion: 1,
      packages: {
        "": {
          name: "@textfilters/pkg",
          version: "1.2.3",
        },
      },
    },
    null,
    2,
  )}\n`;
}, "package-lock.json must use lockfileVersion 2 or newer with packages map");
expectFail("delegated smoke build without success chaining", (state) => {
  state.packageJson.scripts["smoke:dist"] = "npm run build; node smoke.mjs";
}, "script smoke:dist must match an audited dist smoke template");
expectFail("npm exec after valued npm option", (state) => {
  state.packageJson.scripts.lint = "npm --cache .npm-cache exec -c 'node hook.mjs'";
}, "script lint must not use npm exec");
expectFail("npm package mutation after valued npm option", (state) => {
  state.packageJson.scripts.lint =
    "npm --cache .npm-cache pkg set scripts.prepack='node hook.mjs' && prettier . --check";
}, "script lint must not mutate package.json");
expectFail("local script under tools directory", (state) => {
  state.packageJson.scripts["smoke:dist"] = "npm run build && node tools/smoke.mjs";
  state.files = {
    "tools/smoke.mjs": "import { appendFileSync } from 'node:fs';\nappendFileSync('.npmrc', 'dry-run=true\\n');\n",
  };
}, "script smoke:dist referenced file");
expectFail("env split-string local script", (state) => {
  state.packageJson.scripts["smoke:dist"] = "npm run build && env -S 'node ./hook.mjs'";
  state.files = {
    "hook.mjs": "import { appendFileSync } from 'node:fs';\nappendFileSync('.npmrc', 'dry-run=true\\n');\n",
  };
}, "script smoke:dist referenced file");
expectFail("experimental loader module scan", (state) => {
  state.packageJson.scripts["smoke:dist"] =
    "npm run build && node --experimental-loader=./hook.mjs smoke.mjs";
  state.files = {
    "hook.mjs": "import { appendFileSync } from 'node:fs';\nappendFileSync('.npmrc', 'dry-run=true\\n');\n",
  };
}, "script smoke:dist referenced file");
expectFail("npm version manifest mutation", (state) => {
  state.packageJson.scripts.lint = "npm version patch --no-git-tag-version && prettier . --check";
}, "script lint must not mutate package.json");
expectFail("registry auth config mutation", (state) => {
  state.packageJson.scripts.lint =
    "npm config set --location=project //npm.pkg.github.com/:_authToken=bogus && prettier . --check";
}, "script lint must not write publish-altering npm config");
expectFail("copy write to npm config", (state) => {
  state.packageJson.scripts.lint = "cp npmrc.template .npmrc && prettier . --check";
  state.files = {
    "npmrc.template": "dry-run=true\n",
  };
}, "script lint must not write npm config files");
expectFail("non-release workflow bare local script interpreter", (state) => {
  state.extraWorkflow = `name: Manual Publish

on:
  workflow_dispatch:

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - run: python3 publish.py
`;
  state.files = {
    "publish.py": "print('publish')\n",
  };
}, "manual-publish.yml must not invoke local workflow scripts or actions");
expectFail("shell negation delegated test", (state) => {
  state.packageJson.scripts.test = "! vitest run";
}, "script test must not use shell command negation");
expectFail("node eval local import scan", (state) => {
  state.packageJson.scripts["smoke:dist"] = "npm run build && node -e \"import('./hook.mjs')\"";
  state.files = {
    "hook.mjs": "import { appendFileSync } from 'node:fs';\nappendFileSync('.npmrc', 'dry-run=true\\n');\n",
  };
}, "script smoke:dist referenced file");
expectFail("package script file interpreter scan", (state) => {
  state.packageJson.scripts.lint = "python3 hook.py && prettier . --check";
  state.files = {
    "hook.py": "from pathlib import Path\nPath('.npmrc').write_text('dry-run=true\\n')\n",
  };
}, "script lint referenced file");
expectFail("checked-in scoped npm auth config", (state) => {
  state.files = {
    ".npmrc": "//npm.pkg.github.com/:_authToken=bogus\n",
  };
}, ".npmrc must not set //npm.pkg.github.com/:_authToken");
expectFail("shell parameter fallback publish command", (state) => {
  state.extraWorkflow = `name: Manual Publish

on:
  workflow_dispatch:

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - run: \${x:-npm} publish --registry=https://npm.pkg.github.com
`;
}, "manual-publish.yml must not include npm publish");
expectFail("obfuscated child_process module reference", (state) => {
  state.packageJson.scripts["smoke:dist"] = "npm run build && node smoke.mjs";
  state.files = {
    "smoke.mjs":
      "const cp = await import('node:child_' + 'process');\ncp.spawnSync('npm', ['publish', '--registry=https://npm.pkg.github.com']);\n",
  };
}, "script smoke:dist referenced file");
expectFail("template literal local dynamic import scan", (state) => {
  state.packageJson.scripts["smoke:dist"] = "npm run build && node smoke.mjs";
  state.files = {
    "smoke.mjs": "await import(`./hook.mjs`);\n",
    "hook.mjs": "import { appendFileSync } from 'node:fs';\nappendFileSync('.npmrc', 'dry-run=true\\n');\n",
  };
}, "script smoke:dist referenced file");
expectFail("scoped auth npm config env key", (state) => {
  state.releaseWorkflow = state.releaseWorkflow.replace(
    "          NODE_AUTH_TOKEN: ${{ github.token }}\n        run: npm publish --registry=https://npm.pkg.github.com",
    "          NODE_AUTH_TOKEN: ${{ github.token }}\n          \"npm_config_//npm.pkg.github.com/:_authToken\": bogus\n        run: npm publish --registry=https://npm.pkg.github.com",
  );
}, ".github/workflows/release-please.yml must not set publish-altering npm config env");
expectFail("sourced shell helper dependency scan", (state) => {
  state.packageJson.scripts["smoke:dist"] = "npm run build && sh smoke.sh";
  state.files = {
    "smoke.sh": ". ./hook.sh\n",
    "hook.sh": "printf 'dry-run=true\\n' > .npmrc\n",
  };
}, "script smoke:dist referenced file");
expectFail("non-shell interpreter eval snippet", (state) => {
  state.extraWorkflow = `name: Manual Publish

on:
  workflow_dispatch:

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - run: python3 -c "import subprocess; subprocess.run(['npm', 'publish', '--registry=https://npm.pkg.github.com'])"
`;
}, "manual-publish.yml must not use non-shell interpreter eval snippets");
expectFail("sed in-place npm config edit", (state) => {
  state.packageJson.scripts.lint = "sed -i '$a dry-run=true' .npmrc && prettier . --check";
}, "script lint must not write npm config files");
expectFail("computed JavaScript npm config write", (state) => {
  state.packageJson.scripts["smoke:dist"] = "npm run build && node smoke.mjs";
  state.files = {
    "smoke.mjs": "import { appendFileSync } from 'node:fs';\nappendFileSync('.npm' + 'rc', 'dry-run=true\\n');\n",
  };
}, "script smoke:dist referenced file");
expectFail("alias-based publish wrapper", (state) => {
  state.extraWorkflow = `name: Manual Publish

on:
  workflow_dispatch:

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - run: shopt -s expand_aliases; alias p='npm publish --registry=https://npm.pkg.github.com'; p
`;
}, "manual-publish.yml must not define shell aliases");
expectFail("multi-line dynamic import scan", (state) => {
  state.packageJson.scripts["smoke:dist"] = "npm run build && node smoke.mjs";
  state.files = {
    "smoke.mjs": "await import(\n  /* local hook */\n  './hook.mjs'\n);\n",
    "hook.mjs": "import { appendFileSync } from 'node:fs';\nappendFileSync('.npmrc', 'dry-run=true\\n');\n",
  };
}, "script smoke:dist referenced file");
expectFail("vitest discovered test file mutation", (state) => {
  state.files = {
    "tests/mutate.test.ts": "import { appendFileSync } from 'node:fs';\nappendFileSync('.npmrc', 'dry-run=true\\n');\n",
  };
}, "tests/mutate.test.ts must not write npm config files");
expectFail("prettier config file mutation", (state) => {
  state.files = {
    "prettier.config.mjs": "import { appendFileSync } from 'node:fs';\nappendFileSync('.npmrc', 'dry-run=true\\n');\nexport default {};\n",
  };
}, "prettier.config.mjs must not write npm config files");
expectFail("shell interpreter stdin script", (state) => {
  state.extraWorkflow = `name: Manual Publish

on:
  workflow_dispatch:

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - run: bash <<< 'npm publish --registry=https://npm.pkg.github.com'
`;
}, "manual-publish.yml must not feed scripts to shell interpreters on stdin");
expectFail("make target local workflow code", (state) => {
  state.extraWorkflow = `name: Manual Publish

on:
  workflow_dispatch:

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - run: make publish
`;
  state.files = {
    Makefile: "publish:\n\tnpm publish --registry=https://npm.pkg.github.com\n",
  };
}, "manual-publish.yml must not invoke local workflow scripts or actions");
expectFail("JavaScript cpSync npm config write", (state) => {
  state.packageJson.scripts["smoke:dist"] = "npm run build && node smoke.mjs";
  state.files = {
    "smoke.mjs": "import { cpSync } from 'node:fs';\ncpSync('npmrc.template', '.npmrc');\n",
    "npmrc.template": "dry-run=true\n",
  };
}, "script smoke:dist referenced file");
expectFail("provenance npm config rejected", (state) => {
  state.files = {
    ".npmrc": "provenance=true\n",
  };
}, ".npmrc must not set provenance");
expectFail("vitest config file mutation", (state) => {
  state.files = {
    "vitest.config.mjs": "import { appendFileSync } from 'node:fs';\nappendFileSync('.npmrc', 'dry-run=true\\n');\nexport default {};\n",
  };
}, "vitest.config.mjs must not write npm config files");
expectFail("xargs-built publish command", (state) => {
  state.extraWorkflow = `name: Manual Publish

on:
  workflow_dispatch:

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - run: printf 'publish --registry=https://npm.pkg.github.com\\n' | xargs npm
`;
}, "manual-publish.yml must not use xargs command execution");
expectFail("env split-string publish command", (state) => {
  state.extraWorkflow = `name: Manual Publish

on:
  workflow_dispatch:

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - run: env -S 'npm publish --registry=https://npm.pkg.github.com'
`;
}, "manual-publish.yml must not include npm publish");
expectFail("test-imported source module mutation", (state) => {
  state.files = {
    "tests/mutate.test.ts": "import '../src/mutate.ts';\n",
    "src/mutate.ts": "import { appendFileSync } from 'node:fs';\nappendFileSync('.npmrc', 'dry-run=true\\n');\n",
  };
}, "tests/mutate.test.ts must not write npm config files");
expectFail("actions expression publish command", (state) => {
  state.extraWorkflow = `name: Manual Publish

on:
  workflow_dispatch:

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - run: npm\${{ '' }} publish --registry=https://npm.pkg.github.com
`;
}, "manual-publish.yml must not include npm publish");
expectFail("workflow env publish command word", (state) => {
  state.extraWorkflow = `name: Manual Publish

on:
  workflow_dispatch:

env:
  CMD: npm

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - run: $CMD publish --registry=https://npm.pkg.github.com
`;
}, "manual-publish.yml must not include npm publish");
expectFail("python module workflow entry point", (state) => {
  state.extraWorkflow = `name: Manual Publish

on:
  workflow_dispatch:

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - run: python3 -m publish
`;
  state.files = {
    "publish.py": "import os\nos.system('npm publish --registry=https://npm.pkg.github.com')\n",
  };
}, "manual-publish.yml must not invoke local workflow scripts or actions");
expectFail("python stdin script", (state) => {
  state.extraWorkflow = `name: Manual Publish

on:
  workflow_dispatch:

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - run: |
          python3 <<'PY'
          import os
          os.system('npm publish --registry=https://npm.pkg.github.com')
          PY
`;
}, "manual-publish.yml must not feed scripts to shell interpreters on stdin");
expectFail("JavaScript symlink npm config write", (state) => {
  state.files = {
    "prettier.config.mjs": "import { symlinkSync } from 'node:fs';\nsymlinkSync('npmrc.template', '.npmrc');\nexport default {};\n",
    "npmrc.template": "dry-run=true\n",
  };
}, "prettier.config.mjs must not write npm config files");

console.log("Regression contract checks passed.");

function expectPass(name, mutator = () => {}) {
  writeFixture(mutator);
  const result = runGuard();
  if (!result.ok) {
    throw new Error(`${name} should pass:\n${result.output}`);
  }
}

function expectFail(name, mutator, expected) {
  writeFixture(mutator);
  const result = runGuard();
  if (result.ok || !result.output.includes(expected)) {
    throw new Error(`${name} should fail with ${expected}:\n${result.output}`);
  }
}

function writeFixture(mutator) {
  const directory = `pkg-${fixtureIndex}`;
  fixtureIndex += 1;
  const packageDir = join(root, directory);
  mkdirSync(join(packageDir, ".github", "workflows"), { recursive: true });

  const state = {
    packageJson: packageManifest(),
    releaseConfig: releasePleaseConfig(),
    manifest: { ".": "1.2.3" },
    packageLock: `${JSON.stringify(packageLock(), null, 2)}\n`,
    checkWorkflow: checkWorkflow(),
    releaseWorkflow: releaseWorkflow(),
    files: {},
  };

  mutator(state);

  writeFileSync(join(root, "package-contract.json"), JSON.stringify(contract(directory), null, 2));
  writeFileSync(join(packageDir, "package.json"), JSON.stringify(state.packageJson, null, 2));
  writeFileSync(join(packageDir, "README.md"), "# Fixture\n");
  writeFileSync(join(packageDir, "LICENSE"), "MIT\n");
  writeFileSync(join(packageDir, "package-lock.json"), state.packageLock);
  writeFileSync(join(packageDir, "release-please-config.json"), JSON.stringify(state.releaseConfig, null, 2));
  writeFileSync(join(packageDir, ".release-please-manifest.json"), JSON.stringify(state.manifest, null, 2));
  writeFileSync(join(packageDir, ".github", "workflows", "check.yml"), state.checkWorkflow);
  writeFileSync(join(packageDir, ".github", "workflows", "release-please.yml"), state.releaseWorkflow);
  if (state.extraWorkflow) {
    writeFileSync(join(packageDir, ".github", "workflows", "manual-publish.yml"), state.extraWorkflow);
  }
  for (const [path, content] of Object.entries(state.files)) {
    const filePath = join(packageDir, path);
    mkdirSync(dirname(filePath), { recursive: true });
    writeFileSync(filePath, content);
  }
}

function runGuard() {
  try {
    return {
      ok: true,
      output: execFileSync(process.execPath, [scriptPath], { encoding: "utf8" }),
    };
  } catch (error) {
    return {
      ok: false,
      output: `${error.stdout ?? ""}${error.stderr ?? ""}`,
    };
  }
}

function packageManifest() {
  return {
    name: "@textfilters/pkg",
    version: "1.2.3",
    type: "module",
    license: "MIT",
    sideEffects: false,
    files: ["dist", "README.md", "LICENSE"],
    scripts: {
      lint: "prettier README.md docs examples package.json src tests --check",
      test: "vitest run",
      build: "tsc -p tsconfig.json",
      prepack: "npm run build",
      "smoke:dist":
        "node --input-type=module --eval \"const mod = await import('./dist/index.js'); if (!mod) throw new Error('missing exports');\"",
      "pack:dry-run": "npm pack --dry-run",
      check: "npm run lint && npm test && npm run build && npm run smoke:dist && npm run pack:dry-run",
    },
    devDependencies: {
      prettier: "^3.8.3",
      typescript: "^6.0.3",
      vitest: "^4.1.7",
    },
    engines: { node: ">=24" },
    packageManager: "npm@11.16.0",
    publishConfig: { registry: "https://npm.pkg.github.com" },
  };
}

function releasePleaseConfig() {
  return {
    "include-component-in-tag": false,
    packages: {
      ".": {
        "package-name": "@textfilters/pkg",
        "release-type": "node",
      },
    },
  };
}

function packageLock() {
  return {
    lockfileVersion: 3,
    packages: {
      "": {
        name: "@textfilters/pkg",
        version: "1.2.3",
      },
    },
  };
}

function checkWorkflow() {
  return `name: Check

on:
  pull_request:
  push:
    branches:
      - main

permissions:
  contents: read
  packages: read

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
      - uses: actions/setup-node@v6
        with:
          node-version: 24
          registry-url: https://npm.pkg.github.com
          scope: "@textfilters"
      - name: Install dependencies
        env:
          NODE_AUTH_TOKEN: \${{ github.token }}
        run: npm ci
      - name: Run checks
        run: npm run check
`;
}

function releaseWorkflow() {
  return `name: Release Please

on:
  push:
    branches:
      - main

permissions:
  contents: read

jobs:
  release-please:
    runs-on: ubuntu-latest
    permissions:
      contents: write
      issues: write
      pull-requests: write
    outputs:
      release_created: \${{ steps.release.outputs.release_created }}
    steps:
      - uses: googleapis/release-please-action@v5
        id: release
        with:
          token: \${{ secrets.RELEASE_PLEASE_TOKEN }}
          config-file: release-please-config.json
          manifest-file: .release-please-manifest.json

  publish:
    needs: release-please
    if: \${{ needs.release-please.outputs.release_created == 'true' }}
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    steps:
      - uses: actions/checkout@v6
      - uses: actions/setup-node@v6
        with:
          node-version: 24
          registry-url: https://npm.pkg.github.com
          scope: "@textfilters"
      - name: Install dependencies
        env:
          NODE_AUTH_TOKEN: \${{ github.token }}
        run: npm ci
      - name: Run checks
        run: npm run check
      - name: Publish to GitHub Packages
        env:
          NODE_AUTH_TOKEN: \${{ github.token }}
        run: npm publish --registry=https://npm.pkg.github.com
`;
}

function contract(directory) {
  return {
    packagesRoot: ".",
    packages: [{ directory, name: "@textfilters/pkg" }],
    manifest: {
      type: "module",
      license: "MIT",
      sideEffects: false,
      engines: { node: ">=24" },
      packageManager: "npm@11.16.0",
      publishConfig: { registry: "https://npm.pkg.github.com" },
      requiredFiles: ["dist", "README.md", "LICENSE"],
      requiredScripts: {
        build: "tsc -p tsconfig.json",
        prepack: "npm run build",
        "pack:dry-run": "npm pack --dry-run",
      },
      requiredScriptNames: ["lint", "test", "build", "smoke:dist", "pack:dry-run", "check"],
      requiredLockfiles: ["package-lock.json"],
      checkScriptMustInclude: ["npm run lint", "npm test", "npm run smoke:dist", "npm run pack:dry-run"],
      buildMustRunBeforeDistSmoke: true,
      commonDevDependencies: {
        prettier: "^3.8.3",
        typescript: "^6.0.3",
        vitest: "^4.1.7",
      },
    },
    checkWorkflow: {
      path: ".github/workflows/check.yml",
      name: "Check",
      nodeVersion: "24",
      registryUrl: "https://npm.pkg.github.com",
      scope: "@textfilters",
      checkoutAction: "actions/checkout@v6",
      setupNodeAction: "actions/setup-node@v6",
      installCommand: "npm ci",
      checkCommand: "npm run check",
    },
    releaseWorkflow: {
      path: ".github/workflows/release-please.yml",
      name: "Release Please",
      releaseAction: "googleapis/release-please-action@v5",
      token: "${{ secrets.RELEASE_PLEASE_TOKEN }}",
      configFile: "release-please-config.json",
      manifestFile: ".release-please-manifest.json",
      releaseStepId: "release",
      releaseCreatedOutput: "release_created: ${{ steps.release.outputs.release_created }}",
      publishNeeds: "release-please",
      publishCondition: "${{ needs.release-please.outputs.release_created == 'true' }}",
      publishCommand: "npm publish --registry=https://npm.pkg.github.com",
    },
    releasePleaseConfig: {
      includeComponentInTag: false,
      releaseType: "node",
    },
  };
}
