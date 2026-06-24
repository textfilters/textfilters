export function runCases(expectPass, expectFail) {
  expectFail("pnpm publish command", (state) => {
    state.extraWorkflow = `name: Manual Publish

  on:
    workflow_dispatch:

  jobs:
    publish:
      runs-on: ubuntu-latest
      steps:
        - run: pnpm publish --registry=https://npm.pkg.github.com
  `;
  }, "manual-publish.yml must not include npm publish");
  expectFail("vitest global setup file mutation", (state) => {
    state.files = {
      "vitest.config.mjs": "export default { test: { globalSetup: ['./setup.ts'] } };\n",
      "setup.ts": "import { appendFileSync } from 'node:fs';\nappendFileSync('.npmrc', 'dry-run=true\\n');\n",
    };
  }, "vitest.config.mjs must not write npm config files");
  expectFail("vitest include glob outside tests mutation", (state) => {
    state.files = {
      "vitest.config.mjs": "export default { test: { include: ['./src/**/*.{test,spec}.?(c|m)[jt]s?(x)'] } };\n",
      "src/nested/mutate.test.ts":
        "import { appendFileSync } from 'node:fs';\nappendFileSync('.npmrc', 'dry-run=true\\n');\n",
    };
  }, "vitest.config.mjs must not write npm config files");
  expectFail("workflow expanded variable command word publish", (state) => {
    state.extraWorkflow = `name: Manual Publish

  on:
    workflow_dispatch:

  jobs:
    publish:
      runs-on: ubuntu-latest
      steps:
        - run: CMD='npm publish'; $CMD --registry=https://npm.pkg.github.com
  `;
  }, "manual-publish.yml must not include npm publish");
  expectFail("vitest reporter file mutation", (state) => {
    state.files = {
      "vitest.config.mjs": "export default { test: { reporters: ['./reporter.ts'] } };\n",
      "reporter.ts": "import { appendFileSync } from 'node:fs';\nappendFileSync('.npmrc', 'dry-run=true\\n');\n",
    };
  }, "vitest.config.mjs must not write npm config files");
  expectFail("tooling child_process fork execution", (state) => {
    state.files = {
      "prettier.config.mjs":
        "import { fork } from 'node:child_process';\nfork('./hook.mjs');\nexport default {};\n",
      "hook.mjs": "console.log('hook');\n",
    };
  }, "prettier.config.mjs must not use child_process command execution");
  expectFail("workflow relative PATH lookup local script", (state) => {
    state.extraWorkflow = `name: Manual Publish

  on:
    workflow_dispatch:

  jobs:
    publish:
      runs-on: ubuntu-latest
      steps:
        - run: PATH=./scripts:$PATH publish.sh
  `;
    state.files = {
      "scripts/publish.sh": "npm publish --registry=https://npm.pkg.github.com\n",
    };
  }, "manual-publish.yml must not invoke local workflow scripts or actions");
  expectFail("prettier YAML plugin mutation", (state) => {
    state.files = {
      ".prettierrc.yaml": "plugins:\n  - ./plugin.mjs\n",
      "plugin.mjs": "import { appendFileSync } from 'node:fs';\nappendFileSync('.npmrc', 'dry-run=true\\n');\n",
    };
  }, ".prettierrc.yaml must not write npm config files");
  expectFail("prettier YML plugin mutation", (state) => {
    state.files = {
      ".prettierrc.yml": "plugins: ['./plugin.mjs']\n",
      "plugin.mjs": "import { appendFileSync } from 'node:fs';\nappendFileSync('.npmrc', 'dry-run=true\\n');\n",
    };
  }, ".prettierrc.yml must not write npm config files");
  expectFail("backslash-escaped publish command words", (state) => {
    state.extraWorkflow = `name: Manual Publish

  on:
    workflow_dispatch:

  jobs:
    publish:
      runs-on: ubuntu-latest
      steps:
        - run: n\\pm p\\ublish --registry=https://npm.pkg.github.com
  `;
  }, "manual-publish.yml must not include npm publish");
  expectFail("package json prettier plugin mutation", (state) => {
    state.packageJson.prettier = { plugins: ["./plugin.mjs"] };
    state.files = {
      "plugin.mjs": "import { appendFileSync } from 'node:fs';\nappendFileSync('.npmrc', 'dry-run=true\\n');\n",
    };
  }, "package.json must not write npm config files");
  expectFail("escaped local static import mutation", (state) => {
    state.files = {
      "prettier.config.mjs": "import './h\\x6fok.mjs';\nexport default {};\n",
      "hook.mjs": "import { appendFileSync } from 'node:fs';\nappendFileSync('.npmrc', 'dry-run=true\\n');\n",
    };
  }, "prettier.config.mjs must not write npm config files");
  expectFail("concatenated vitest setup path mutation", (state) => {
    state.files = {
      "vitest.config.mjs": "export default { test: { setupFiles: ['./set' + 'up.ts'] } };\n",
      "setup.ts": "import { appendFileSync } from 'node:fs';\nappendFileSync('.npmrc', 'dry-run=true\\n');\n",
    };
  }, "vitest.config.mjs must not write npm config files");
  expectFail("yarn publish command", (state) => {
    state.extraWorkflow = `name: Manual Publish

  on:
    workflow_dispatch:

  jobs:
    publish:
      runs-on: ubuntu-latest
      steps:
        - run: yarn publish --registry=https://npm.pkg.github.com
  `;
  }, "manual-publish.yml must not include npm publish");
  expectFail("actions format expression publish command", (state) => {
    state.extraWorkflow = `name: Manual Publish

  on:
    workflow_dispatch:

  jobs:
    publish:
      runs-on: ubuntu-latest
      steps:
        - run: \${{ format('npm') }} publish --registry=https://npm.pkg.github.com
  `;
  }, "manual-publish.yml must not include npm publish");
  expectFail("brace-expanded publish command", (state) => {
    state.extraWorkflow = `name: Manual Publish

  on:
    workflow_dispatch:

  jobs:
    publish:
      runs-on: ubuntu-latest
      steps:
        - run: npm publ{ish,} --registry=https://npm.pkg.github.com
  `;
  }, "manual-publish.yml must not use shell globs in run commands");
  expectFail("workflow multiline PATH lookup local script", (state) => {
    state.extraWorkflow = `name: Manual Publish

  on:
    workflow_dispatch:

  jobs:
    publish:
      runs-on: ubuntu-latest
      steps:
        - run: |
            PATH=.:$PATH
            publish.sh
  `;
    state.files = {
      "publish.sh": "npm publish --registry=https://npm.pkg.github.com\n",
    };
  }, "manual-publish.yml must not invoke local workflow scripts or actions");
  expectFail("workflow for-loop variable publish command", (state) => {
    state.extraWorkflow = `name: Manual Publish

  on:
    workflow_dispatch:

  jobs:
    publish:
      runs-on: ubuntu-latest
      steps:
        - run: for c in npm; do $c publish --registry=https://npm.pkg.github.com; done
  `;
  }, "manual-publish.yml must not include npm publish");
  expectFail("vitest project config mutation", (state) => {
    state.files = {
      "vitest.config.mjs": "export default { test: { projects: ['./project/vitest.config.mjs'] } };\n",
      "project/vitest.config.mjs":
        "import { appendFileSync } from 'node:fs';\nappendFileSync('.npmrc', 'dry-run=true\\n');\nexport default {};\n",
    };
  }, "vitest.config.mjs must not write npm config files");
  expectFail("shell-quoted publish command words", (state) => {
    state.extraWorkflow = `name: Manual Publish

  on:
    workflow_dispatch:

  jobs:
    publish:
      runs-on: ubuntu-latest
      steps:
        - run: n"p"m p"ublish" --registry=https://npm.pkg.github.com
  `;
  }, "manual-publish.yml must not include npm publish");
  expectFail("workflow bare source local script", (state) => {
    state.extraWorkflow = `name: Manual Publish

  on:
    workflow_dispatch:

  jobs:
    publish:
      runs-on: ubuntu-latest
      steps:
        - run: source publish.sh
  `;
    state.files = {
      "publish.sh": "npm publish --registry=https://npm.pkg.github.com\n",
    };
  }, "manual-publish.yml must not invoke local workflow scripts or actions");
  expectFail("tooling variable dynamic import mutation", (state) => {
    state.files = {
      "prettier.config.mjs": "const p = './hook.mjs';\nawait import(p);\nexport default {};\n",
      "hook.mjs": "import { appendFileSync } from 'node:fs';\nappendFileSync('.npmrc', 'dry-run=true\\n');\n",
    };
  }, "prettier.config.mjs must not write npm config files");
  expectFail("prettier TOML plugin mutation", (state) => {
    state.files = {
      ".prettierrc.toml": "plugins = [\"./plugin.mjs\"]\n",
      "plugin.mjs": "import { appendFileSync } from 'node:fs';\nappendFileSync('.npmrc', 'dry-run=true\\n');\n",
    };
  }, ".prettierrc.toml must not write npm config files");
  expectFail("vitest workspace config mutation", (state) => {
    state.files = {
      "vitest.workspace.ts":
        "import { appendFileSync } from 'node:fs';\nappendFileSync('.npmrc', 'dry-run=true\\n');\nexport default [];\n",
    };
  }, "vitest.workspace.ts must not write npm config files");
  expectFail("vitest workspace project config mutation", (state) => {
    state.files = {
      "vitest.workspace.ts": "export default ['./project/vitest.config.mjs'];\n",
      "project/vitest.config.mjs":
        "import { appendFileSync } from 'node:fs';\nappendFileSync('.npmrc', 'dry-run=true\\n');\nexport default {};\n",
    };
  }, "vitest.workspace.ts must not write npm config files");
  expectFail("workflow env expression publish command", (state) => {
    state.extraWorkflow = `name: Manual Publish

  on:
    workflow_dispatch:

  jobs:
    publish:
      runs-on: ubuntu-latest
      env:
        CMD: \${{ format('npm') }}
      steps:
        - run: $CMD publish --registry=https://npm.pkg.github.com
  `;
  }, "manual-publish.yml must not include npm publish");
}
