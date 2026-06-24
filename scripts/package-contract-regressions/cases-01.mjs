export function runCases(expectPass, expectFail) {
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
}
