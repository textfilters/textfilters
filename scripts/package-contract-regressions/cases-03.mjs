export function runCases(expectPass, expectFail) {
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
  expectFail("prettier TypeScript rc mutation", (state) => {
    state.files = {
      ".prettierrc.ts": "import { appendFileSync } from 'node:fs';\nappendFileSync('.npmrc', 'dry-run=true\\n');\nexport default {};\n",
    };
  }, ".prettierrc.ts must not write npm config files");
  expectFail("multiline static import dependency scan", (state) => {
    state.files = {
      "tests/mutate.test.ts": "import {\n  mutate\n} from '../src/mutate.ts';\nmutate();\n",
      "src/mutate.ts": "import { appendFileSync } from 'node:fs';\nexport function mutate() {\n  appendFileSync('.npmrc', 'dry-run=true\\n');\n}\n",
    };
  }, "tests/mutate.test.ts must not write npm config files");
  expectFail("workflow env scoped before later override", (state) => {
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
        - env:
            CMD: echo
          run: $CMD done
  `;
  }, "manual-publish.yml must not include npm publish");
  expectFail("workflow local code through normalized env", (state) => {
    state.extraWorkflow = `name: Manual Publish

  on:
    workflow_dispatch:

  jobs:
    publish:
      runs-on: ubuntu-latest
      steps:
        - env:
            SCRIPT: publish.sh
          run: bash $SCRIPT
  `;
    state.files = {
      "publish.sh": "npm publish --registry=https://npm.pkg.github.com\n",
    };
  }, "manual-publish.yml must not invoke local workflow scripts or actions");
  expectFail("shell interpreter stdin file redirection", (state) => {
    state.extraWorkflow = `name: Manual Publish

  on:
    workflow_dispatch:

  jobs:
    publish:
      runs-on: ubuntu-latest
      steps:
        - run: bash < publish.sh
  `;
    state.files = {
      "publish.sh": "npm publish --registry=https://npm.pkg.github.com\n",
    };
  }, "manual-publish.yml must not feed scripts to shell interpreters on stdin");
  expectFail("tooling config imports examples helper", (state) => {
    state.files = {
      "prettier.config.mjs": "import './examples/hook.mjs';\nexport default {};\n",
      "examples/hook.mjs": "import { appendFileSync } from 'node:fs';\nappendFileSync('.npmrc', 'dry-run=true\\n');\n",
    };
  }, "prettier.config.mjs must not write npm config files");
  expectFail("prettier plugin module mutation", (state) => {
    state.files = {
      ".prettierrc.json": JSON.stringify({ plugins: ["./plugin.mjs"] }, null, 2),
      "plugin.mjs": "import { appendFileSync } from 'node:fs';\nappendFileSync('.npmrc', 'dry-run=true\\n');\n",
    };
  }, ".prettierrc.json must not write npm config files");
  expectFail("vitest setup file mutation", (state) => {
    state.files = {
      "vitest.config.mjs": "export default { test: { setupFiles: ['./setup.ts'] } };\n",
      "setup.ts": "import { appendFileSync } from 'node:fs';\nappendFileSync('.npmrc', 'dry-run=true\\n');\n",
    };
  }, "vitest.config.mjs must not write npm config files");
  expectFail("workflow publish shell glob", (state) => {
    state.extraWorkflow = `name: Manual Publish

  on:
    workflow_dispatch:

  jobs:
    publish:
      runs-on: ubuntu-latest
      steps:
        - run: npm publis? --registry=https://npm.pkg.github.com
  `;
    state.files = {
      publish: "",
    };
  }, "manual-publish.yml must not use shell globs in run commands");
  expectFail("package script publish shell glob", (state) => {
    state.packageJson.scripts.lint = "npm publis? --registry=https://npm.pkg.github.com";
    state.files = {
      publish: "",
    };
  }, "script lint must not use shell globs");
  expectFail("escaped child_process module reference", (state) => {
    state.packageJson.scripts["smoke:dist"] = "npm run build && node smoke.mjs";
    state.files = {
      "smoke.mjs":
        "const cp = await import('node:child\\x5fprocess');\ncp.spawnSync('npm', ['publish', '--registry=https://npm.pkg.github.com']);\n",
    };
  }, "must not use child_process command execution");
  expectFail("workflow process substitution source", (state) => {
    state.extraWorkflow = `name: Manual Publish

  on:
    workflow_dispatch:

  jobs:
    publish:
      runs-on: ubuntu-latest
      steps:
        - run: source <(echo 'npm publish --registry=https://npm.pkg.github.com')
  `;
  }, "manual-publish.yml must not use shell process substitution");
  expectFail("workflow path lookup local script", (state) => {
    state.extraWorkflow = `name: Manual Publish

  on:
    workflow_dispatch:

  jobs:
    publish:
      runs-on: ubuntu-latest
      steps:
        - run: PATH=.:$PATH publish.sh
  `;
    state.files = {
      "publish.sh": "npm publish --registry=https://npm.pkg.github.com\n",
    };
  }, "manual-publish.yml must not invoke local workflow scripts or actions");
  expectFail("workflow env path lookup local script", (state) => {
    state.extraWorkflow = `name: Manual Publish

  on:
    workflow_dispatch:

  jobs:
    publish:
      runs-on: ubuntu-latest
      steps:
        - run: env PATH=.:$PATH publish.sh
  `;
    state.files = {
      "publish.sh": "npm publish --registry=https://npm.pkg.github.com\n",
    };
  }, "manual-publish.yml must not invoke local workflow scripts or actions");
  expectFail("workflow variable path lookup local script", (state) => {
    state.extraWorkflow = `name: Manual Publish

  on:
    workflow_dispatch:

  jobs:
    publish:
      runs-on: ubuntu-latest
      steps:
        - run: p=.; PATH=$p:$PATH publish.sh
  `;
    state.files = {
      "publish.sh": "npm publish --registry=https://npm.pkg.github.com\n",
    };
  }, "manual-publish.yml must not invoke local workflow scripts or actions");
  expectFail("ANSI-C quoted publish command", (state) => {
    state.extraWorkflow = `name: Manual Publish

  on:
    workflow_dispatch:

  jobs:
    publish:
      runs-on: ubuntu-latest
      steps:
        - run: n$'\\x70'm $'\\x70ublish' --registry=https://npm.pkg.github.com
  `;
  }, "manual-publish.yml must not include npm publish");
  expectFail("workflow block scalar env publish command", (state) => {
    state.extraWorkflow = `name: Manual Publish

  on:
    workflow_dispatch:

  jobs:
    publish:
      runs-on: ubuntu-latest
      steps:
        - env:
            CMD: >-
              npm
          run: $CMD publish --registry=https://npm.pkg.github.com
  `;
  }, "manual-publish.yml must not include npm publish");
  expectFail("computed child_process method reference", (state) => {
    state.files = {
      "prettier.config.mjs":
        "const cp = await import('node:child_process');\ncp['sp' + 'awnSync']('npm', ['publish', '--registry=https://npm.pkg.github.com']);\nexport default {};\n",
    };
  }, "prettier.config.mjs must not use child_process command execution");
}
