export function runCases(expectPass, expectFail) {
  expectFail("workflow unknown env expression publish command", (state) => {
    state.extraWorkflow = `name: Manual Publish

  on:
    workflow_dispatch:
      inputs:
        command:
          type: string
          default: npm

  jobs:
    publish:
      runs-on: ubuntu-latest
      env:
        CMD: \${{ inputs.command }}
      steps:
        - run: $CMD publish --registry=https://npm.pkg.github.com
  `;
  }, "manual-publish.yml must not include npm publish");
  expectFail("workflow unknown run expression publish command", (state) => {
    state.extraWorkflow = `name: Manual Publish

  on:
    workflow_dispatch:
      inputs:
        command:
          type: string
          default: npm

  jobs:
    publish:
      runs-on: ubuntu-latest
      steps:
        - run: \${{ inputs.command }} publish --registry=https://npm.pkg.github.com
  `;
  }, "manual-publish.yml must not include npm publish");
  expectFail("workflow GitHub path file write", (state) => {
    state.extraWorkflow = `name: Manual Publish

  on:
    workflow_dispatch:

  jobs:
    publish:
      runs-on: ubuntu-latest
      steps:
        - run: printf './scripts\\n' >> "$GITHUB_PATH"
  `;
  }, "manual-publish.yml must not write GitHub Actions environment files");
  expectFail("flow mapping local action step", (state) => {
    state.extraWorkflow = `name: Manual Publish

  on:
    workflow_dispatch:

  jobs:
    publish:
      runs-on: ubuntu-latest
      steps:
        - { uses: ./publish-action }
  `;
    state.files = {
      "publish-action/action.yml": `runs:
    using: composite
    steps:
      - run: npm publish --registry=https://npm.pkg.github.com
        shell: bash
  `,
    };
  }, "manual-publish.yml must not invoke local workflow scripts or actions");
  expectFail("tooling worker new URL mutation", (state) => {
    state.files = {
      "prettier.config.mjs":
        "import { Worker } from 'node:worker_threads';\nnew Worker(new URL('./hook.mjs', import.meta.url), { type: 'module' });\nexport default {};\n",
      "hook.mjs": "import { appendFileSync } from 'node:fs';\nappendFileSync('.npmrc', 'dry-run=true\\n');\n",
    };
  }, "prettier.config.mjs must not write npm config files");
  expectFail("workflow BASH_ENV startup env", (state) => {
    state.extraWorkflow = `name: Manual Publish

  on:
    workflow_dispatch:

  env: { BASH_ENV: ./hook.sh }

  jobs:
    publish:
      runs-on: ubuntu-latest
      steps:
        - run: echo ok
  `;
    state.files = {
      "hook.sh": "npm publish --registry=https://npm.pkg.github.com\n",
    };
  }, "manual-publish.yml must not set startup hook env");
  expectFail("workflow NODE_OPTIONS startup env", (state) => {
    state.extraWorkflow = `name: Manual Publish

  on:
    workflow_dispatch:

  jobs:
    publish:
      runs-on: ubuntu-latest
      env:
        NODE_OPTIONS: --import ./hook.mjs
      steps:
        - run: node -e "console.log('ok')"
  `;
    state.files = {
      "hook.mjs": "import { appendFileSync } from 'node:fs';\nappendFileSync('.npmrc', 'dry-run=true\\n');\n",
    };
  }, "manual-publish.yml must not set startup hook env");
  expectFail("tooling commented dynamic import mutation", (state) => {
    state.files = {
      "prettier.config.mjs": "await import /* hook */ ('./hook.mjs');\nexport default {};\n",
      "hook.mjs": "import { appendFileSync } from 'node:fs';\nappendFileSync('.npmrc', 'dry-run=true\\n');\n",
    };
  }, "prettier.config.mjs must not write npm config files");
  expectFail("vitest discovered jsx test file mutation", (state) => {
    state.files = {
      "tests/mutate.test.jsx": "import { appendFileSync } from 'node:fs';\nappendFileSync('.npmrc', 'dry-run=true\\n');\n",
    };
  }, "tests/mutate.test.jsx must not write npm config files");
  expectFail("vitest default source test file mutation", (state) => {
    state.files = {
      "src/mutate.test.ts": "import { appendFileSync } from 'node:fs';\nappendFileSync('.npmrc', 'dry-run=true\\n');\n",
    };
  }, "src/mutate.test.ts must not write npm config files");
  expectFail("vitest includeSource mutation", (state) => {
    state.files = {
      "vitest.config.mjs": "export default { test: { includeSource: ['./src/**/*.ts'] } };\n",
      "src/mutate.ts":
        "import { appendFileSync } from 'node:fs';\nif (import.meta.vitest) appendFileSync('.npmrc', 'dry-run=true\\n');\n",
    };
  }, "vitest.config.mjs must not write npm config files");
  expectFail("vitest local environment mutation", (state) => {
    state.files = {
      "vitest.config.mjs": "export default { test: { environment: './env.mjs' } };\n",
      "env.mjs": "import { appendFileSync } from 'node:fs';\nappendFileSync('.npmrc', 'dry-run=true\\n');\n",
    };
  }, "vitest.config.mjs must not write npm config files");
  expectFail("vitest local runner mutation", (state) => {
    state.files = {
      "vitest.config.mjs": "export default { test: { runner: './runner.mjs' } };\n",
      "runner.mjs": "import { appendFileSync } from 'node:fs';\nappendFileSync('.npmrc', 'dry-run=true\\n');\n",
    };
  }, "vitest.config.mjs must not write npm config files");
  expectFail("workflow extensionless PATH local command", (state) => {
    state.extraWorkflow = `name: Manual Publish

  on:
    workflow_dispatch:

  jobs:
    publish:
      runs-on: ubuntu-latest
      steps:
        - run: PATH=.:$PATH publish
  `;
    state.files = {
      publish: "npm publish --registry=https://npm.pkg.github.com\n",
    };
  }, "manual-publish.yml must not invoke local workflow scripts or actions");
  expectFail("workflow YAML escaped publish command", (state) => {
    state.extraWorkflow = `name: Manual Publish

  on:
    workflow_dispatch:

  jobs:
    publish:
      runs-on: ubuntu-latest
      steps:
        - run: "\\x6e\\x70\\x6d \\x70\\x75\\x62\\x6c\\x69\\x73\\x68 --registry=https://npm.pkg.github.com"
  `;
  }, "manual-publish.yml must not include npm publish");
  expectFail("flow mapping run local workflow code", (state) => {
    state.extraWorkflow = `name: Manual Publish

  on:
    workflow_dispatch:

  jobs:
    publish:
      runs-on: ubuntu-latest
      steps:
        - { run: ./publish.sh }
  `;
    state.files = {
      "publish.sh": "npm publish --registry=https://npm.pkg.github.com\n",
    };
  }, "manual-publish.yml must not invoke local workflow scripts or actions");
  expectFail("tooling worker string filename mutation", (state) => {
    state.files = {
      "prettier.config.mjs":
        "import { Worker } from 'node:worker_threads';\nnew Worker('./hook.cjs');\nexport default {};\n",
      "hook.cjs": "require('node:fs').appendFileSync('.npmrc', 'dry-run=true\\n');\n",
    };
  }, "prettier.config.mjs must not write npm config files");
  expectFail("workflow shell eval local helper", (state) => {
    state.extraWorkflow = `name: Manual Publish

  on:
    workflow_dispatch:

  jobs:
    publish:
      runs-on: ubuntu-latest
      steps:
        - run: bash -c 'source publish.sh'
  `;
    state.files = {
      "publish.sh": "npm publish --registry=https://npm.pkg.github.com\n",
    };
  }, "manual-publish.yml must not invoke local workflow scripts or actions");
  expectFail("workflow node test discovery", (state) => {
    state.extraWorkflow = `name: Manual Publish

  on:
    workflow_dispatch:

  jobs:
    publish:
      runs-on: ubuntu-latest
      steps:
        - run: node --test
  `;
    state.files = {
      "test/publish.js": "import { execFileSync } from 'node:child_process';\nexecFileSync('npm', ['publish']);\n",
    };
  }, "manual-publish.yml must not invoke local workflow scripts or actions");
  expectFail("tooling createRequire alias mutation", (state) => {
    state.files = {
      "prettier.config.mjs":
        "import { createRequire } from 'node:module';\nconst req = createRequire(import.meta.url);\nreq('./hook.cjs');\nexport default {};\n",
      "hook.cjs": "require('node:fs').appendFileSync('.npmrc', 'dry-run=true\\n');\n",
    };
  }, "prettier.config.mjs must not write npm config files");
  expectFail("workflow inline node preload local hook", (state) => {
    state.extraWorkflow = `name: Manual Publish

  on:
    workflow_dispatch:

  jobs:
    publish:
      runs-on: ubuntu-latest
      steps:
        - run: node --import=./hook.mjs -e ''
  `;
    state.files = {
      "hook.mjs": "import { execFileSync } from 'node:child_process';\nexecFileSync('npm', ['publish']);\n",
    };
  }, "manual-publish.yml must not invoke local workflow scripts or actions");
  expectFail("workflow inline node eval local import", (state) => {
    state.extraWorkflow = `name: Manual Publish

  on:
    workflow_dispatch:

  jobs:
    publish:
      runs-on: ubuntu-latest
      steps:
        - run: node --eval="import('./hook.mjs')"
  `;
    state.files = {
      "hook.mjs": "import { execFileSync } from 'node:child_process';\nexecFileSync('npm', ['publish']);\n",
    };
  }, "manual-publish.yml must not invoke local workflow scripts or actions");
  expectFail("tooling static template import mutation", (state) => {
    state.files = {
      "prettier.config.mjs": "await import(`./${'hook'}.mjs`);\nexport default {};\n",
      "hook.mjs": "import { appendFileSync } from 'node:fs';\nappendFileSync('.npmrc', 'dry-run=true\\n');\n",
    };
  }, "prettier.config.mjs must not write npm config files");
  expectFail("vitest execArgv preload module mutation", (state) => {
    state.files = {
      "vitest.config.mjs":
        "export default { test: { execArgv: ['--import', './hook.mjs'] } };\n",
      "hook.mjs": "import { appendFileSync } from 'node:fs';\nappendFileSync('.npmrc', 'dry-run=true\\n');\n",
    };
  }, "vitest.config.mjs must not write npm config files");
  expectFail("workflow shell variable local command", (state) => {
    state.extraWorkflow = `name: Manual Publish

  on:
    workflow_dispatch:

  jobs:
    publish:
      runs-on: ubuntu-latest
      steps:
        - run: |
            p=./publish.sh
            "$p"
  `;
    state.files = {
      "publish.sh": "npm publish --registry=https://npm.pkg.github.com\n",
    };
  }, "manual-publish.yml must not invoke local workflow scripts or actions");
  expectFail("workflow shell eval source helper", (state) => {
    state.extraWorkflow = `name: Manual Publish

  on:
    workflow_dispatch:

  jobs:
    publish:
      runs-on: ubuntu-latest
      steps:
        - run: eval 'source publish.sh'
  `;
    state.files = {
      "publish.sh": "npm publish --registry=https://npm.pkg.github.com\n",
    };
  }, "manual-publish.yml must not invoke local workflow scripts or actions");
  expectFail("shell prefix removal publish command", (state) => {
    state.extraWorkflow = `name: Manual Publish

  on:
    workflow_dispatch:

  jobs:
    publish:
      runs-on: ubuntu-latest
      steps:
        - run: n=xnpm; \${n#x} publish --registry=https://npm.pkg.github.com
  `;
  }, "manual-publish.yml must not include npm publish");
  expectFail("computed npmrc write path", (state) => {
    state.files = {
      "vitest.config.mjs":
        "import { appendFileSync } from 'node:fs';\nconst p = ['.npm', 'rc'].join('');\nappendFileSync(p, 'dry-run=true\\n');\nexport default {};\n",
    };
  }, "vitest.config.mjs must not write npm config files");
  expectFail("unsupported shell substring expansion publish command", (state) => {
    state.extraWorkflow = `name: Manual Publish

  on:
    workflow_dispatch:

  jobs:
    publish:
      runs-on: ubuntu-latest
      steps:
        - run: cmd=npmpublish; \${cmd:0:3} \${cmd:3} --registry=https://npm.pkg.github.com
  `;
  }, "manual-publish.yml must not use unsupported shell parameter expansion");
  expectFail("awk system publish wrapper", (state) => {
    state.extraWorkflow = `name: Manual Publish

  on:
    workflow_dispatch:

  jobs:
    publish:
      runs-on: ubuntu-latest
      steps:
        - run: awk 'BEGIN{system("npm publish --registry=https://npm.pkg.github.com")}'
  `;
  }, "manual-publish.yml must not use awk command execution");
  expectFail("workflow python run shell publish", (state) => {
    state.extraWorkflow = `name: Manual Publish

  on:
    workflow_dispatch:

  jobs:
    publish:
      runs-on: ubuntu-latest
      steps:
        - shell: python
          run: |
            import os
            os.system('npm publish --registry=https://npm.pkg.github.com')
  `;
  }, "manual-publish.yml must not use non-shell run shells");
  expectFail("env wrapped shell stdin publish", (state) => {
    state.extraWorkflow = `name: Manual Publish

  on:
    workflow_dispatch:

  jobs:
    publish:
      runs-on: ubuntu-latest
      steps:
        - run: printf 'npm publish --registry=https://npm.pkg.github.com' | env sh
  `;
  }, "manual-publish.yml must not feed scripts to shell interpreters on stdin");
  expectFail("vitest root relative setup file mutation", (state) => {
    state.files = {
      "vitest.config.mjs": "export default { test: { setupFiles: ['src/setup.ts'] } };\n",
      "src/setup.ts": "import { appendFileSync } from 'node:fs';\nappendFileSync('.npmrc', 'dry-run=true\\n');\n",
    };
  }, "vitest.config.mjs must not write npm config files");
  expectFail("escaped static import mutation", (state) => {
    state.files = {
      "prettier.config.mjs": "import '\\x2e/hook.mjs';\nexport default {};\n",
      "hook.mjs": "import { appendFileSync } from 'node:fs';\nappendFileSync('.npmrc', 'dry-run=true\\n');\n",
    };
  }, "prettier.config.mjs must not write npm config files");
  expectFail("duplicate workflow run key override", (state) => {
    state.checkWorkflow = state.checkWorkflow.replace(
      "        run: npm ci",
      "        run: npm ci\n        run: echo skipped install",
    );
  }, "check.yml step must not repeat run");
  expectFail("template computed npm config mutation path", (state) => {
    state.files = {
      "vitest.config.mjs": "import { writeFileSync } from 'node:fs';\nconst p = `.npm${'rc'}`;\nwriteFileSync(p, 'dry-run=true\\n');\nexport default {};\n",
    };
  }, "vitest.config.mjs must not write npm config files");
  expectFail("awk output pipe publish command", (state) => {
    state.extraWorkflow = `name: Manual Publish

  on:
    workflow_dispatch:

  jobs:
    publish:
      runs-on: ubuntu-latest
      steps:
        - run: awk 'BEGIN{print "npm publish --registry=https://npm.pkg.github.com" | "sh"}'
  `;
  }, "manual-publish.yml must not use awk command execution");
  expectFail("computed local import mutation", (state) => {
    state.files = {
      "prettier.config.mjs": "await import('./' + 'hook.mjs');\nexport default {};\n",
      "hook.mjs": "import { appendFileSync } from 'node:fs';\nappendFileSync('.npmrc', 'dry-run=true\\n');\n",
    };
  }, "prettier.config.mjs must not write npm config files");
  expectFail("generated temp workflow script", (state) => {
    state.extraWorkflow = `name: Manual Publish

  on:
    workflow_dispatch:

  jobs:
    publish:
      runs-on: ubuntu-latest
      steps:
        - run: printf 'npm publish --registry=https://npm.pkg.github.com\\n' > /tmp/publish.sh; bash /tmp/publish.sh
  `;
  }, "manual-publish.yml must not write generated workflow scripts");
  expectFail("duplicate workflow jobs block", (state) => {
    state.checkWorkflow += `

jobs:
  shadow:
    runs-on: ubuntu-latest
    steps:
      - run: echo shadow
`;
  }, "check.yml must not repeat jobs:");
  expectFail("unknown expression npm subcommand", (state) => {
    state.extraWorkflow = `name: Manual Publish

  on:
    workflow_dispatch:

  jobs:
    publish:
      runs-on: ubuntu-latest
      steps:
        - run: npm \${{ vars.NPM_SUBCOMMAND }} --registry=https://npm.pkg.github.com
  `;
  }, "manual-publish.yml must not include npm publish");
  expectFail("computed vitest setup file path", (state) => {
    state.files = {
      "vitest.config.mjs": "const setupFile = ['src', 'setup.ts'].join('/');\nexport default { test: { setupFiles: [setupFile] } };\n",
      "src/setup.ts": "import { appendFileSync } from 'node:fs';\nappendFileSync('.npmrc', 'dry-run=true\\n');\n",
    };
  }, "vitest.config.mjs must not write npm config files");
  expectFail("joined package manifest mutation path", (state) => {
    state.files = {
      "prettier.config.mjs": "import { writeFileSync } from 'node:fs';\nconst target = ['package', 'json'].join('.');\nwriteFileSync(target, '{}\\n');\nexport default {};\n",
    };
  }, "prettier.config.mjs must not mutate package.json");
  expectFail("explicit dist tooling dependency mutation", (state) => {
    state.files = {
      "vitest.config.mjs": "export default { test: { setupFiles: ['dist/setup.mjs'] } };\n",
      "dist/setup.mjs": "import { appendFileSync } from 'node:fs';\nappendFileSync('.npmrc', 'dry-run=true\\n');\n",
    };
  }, "vitest.config.mjs must not write npm config files");
  expectFail("workflow step mixes uses and run", (state) => {
    state.checkWorkflow = state.checkWorkflow.replace(
      "      - uses: actions/setup-node@v6",
      "      - uses: actions/setup-node@v6\n        run: echo setup",
    );
  }, "check.yml step must not mix uses and run");
  expectFail("computed GitHub environment file mutation", (state) => {
    state.files = {
      "prettier.config.mjs": "import { appendFileSync } from 'node:fs';\nappendFileSync(process.env['GITHUB_' + 'ENV'], 'NODE_OPTIONS=--require ./hook.cjs\\n');\nexport default {};\n",
    };
  }, "prettier.config.mjs must not write GitHub Actions environment files");
  expectFail("smoke eval non-dist import", (state) => {
    state.packageJson.scripts["smoke:dist"] =
      "node --input-type=module --eval \"await import('./dist/index.js'); await import('data:text/javascript,console.log(1)')\"";
  }, "script smoke:dist must match an audited dist smoke template");
  expectFail("direct generated temp workflow script", (state) => {
    state.extraWorkflow = `name: Manual Publish

  on:
    workflow_dispatch:

  jobs:
    publish:
      runs-on: ubuntu-latest
      steps:
        - run: printf 'npm publish --registry=https://npm.pkg.github.com\\n' > /tmp/publish.sh; chmod +x /tmp/publish.sh; /tmp/publish.sh
  `;
  }, "manual-publish.yml must not write generated workflow scripts");
  expectFail("copyFile npm config mutation", (state) => {
    state.files = {
      "prettier.config.mjs": "import { copyFileSync } from 'node:fs';\ncopyFileSync('template.npmrc', '.npmrc');\nexport default {};\n",
    };
  }, "prettier.config.mjs must not write npm config files");
  expectFail("copyFile package manifest mutation", (state) => {
    state.files = {
      "prettier.config.mjs": "import { copyFileSync } from 'node:fs';\ncopyFileSync('manifest.json', 'package.json');\nexport default {};\n",
    };
  }, "prettier.config.mjs must not mutate package.json");
  expectFail("path join vitest setup file path", (state) => {
    state.files = {
      "vitest.config.mjs": "import path from 'node:path';\nconst setupFile = path.join('src', 'setup.ts');\nexport default { test: { setupFiles: [setupFile] } };\n",
      "src/setup.ts": "import { appendFileSync } from 'node:fs';\nappendFileSync('.npmrc', 'dry-run=true\\n');\n",
    };
  }, "vitest.config.mjs must not write npm config files");
  expectFail("combined bash eval flag publish", (state) => {
    state.extraWorkflow = `name: Manual Publish

  on:
    workflow_dispatch:

  jobs:
    publish:
      runs-on: ubuntu-latest
      steps:
        - run: bash -lc 'npm publish --registry=https://npm.pkg.github.com'
  `;
  }, "manual-publish.yml must not include npm publish");
  expectFail("combined python eval flag publish", (state) => {
    state.extraWorkflow = `name: Manual Publish

  on:
    workflow_dispatch:

  jobs:
    publish:
      runs-on: ubuntu-latest
      steps:
        - run: python3 -Ic 'import os; os.system("npm publish --registry=https://npm.pkg.github.com")'
  `;
  }, "manual-publish.yml must not use non-shell interpreter eval snippets");
  expectFail("find exec workflow wrapper", (state) => {
    state.files = {
      "publish.sh": "npm publish --registry=https://npm.pkg.github.com\n",
    };
    state.extraWorkflow = `name: Manual Publish

  on:
    workflow_dispatch:

  jobs:
    publish:
      runs-on: ubuntu-latest
      steps:
        - run: find . -maxdepth 1 -name publish.sh -exec sh {} ';'
  `;
  }, "manual-publish.yml must not use find command execution");
  expectFail("git shell alias publish", (state) => {
    state.extraWorkflow = `name: Manual Publish

  on:
    workflow_dispatch:

  jobs:
    publish:
      runs-on: ubuntu-latest
      steps:
        - run: git -c alias.p='!npm publish --registry=https://npm.pkg.github.com' p
  `;
  }, "manual-publish.yml must not include npm publish");
  expectFail("conditional checkout step", (state) => {
    state.checkWorkflow = state.checkWorkflow.replace(
      "      - uses: actions/checkout@v6",
      "      - if: ${{ false }}\n        uses: actions/checkout@v6",
    );
  }, "check.yml actions/checkout@v6 step must not be conditional");
  expectFail("printf variable publish command", (state) => {
    state.extraWorkflow = `name: Manual Publish

  on:
    workflow_dispatch:

  jobs:
    publish:
      runs-on: ubuntu-latest
      steps:
        - run: printf -v cmd 'npm publish --registry=https://npm.pkg.github.com'; $cmd
  `;
  }, "manual-publish.yml must not include npm publish");
  expectFail("duplicate audited action input", (state) => {
    state.checkWorkflow = state.checkWorkflow.replace(
      "          node-version: 24",
      "          node-version: 24\n          node-version: 20",
    );
  }, "check.yml step with block must not repeat node-version");
  expectFail("workflow format expression publish command", (state) => {
    state.extraWorkflow = `name: Manual Publish

  on:
    workflow_dispatch:

  jobs:
    publish:
      runs-on: ubuntu-latest
      steps:
        - run: \${{ format('{0} {1}', 'npm', 'publish') }} --registry=https://npm.pkg.github.com
  `;
  }, "manual-publish.yml must not include npm publish");
  expectFail("tooling joined child process method publish", (state) => {
    state.files = {
      "prettier.config.mjs":
        "import cp from 'node:child_process';\nconst method = ['sp', 'awnSync'].join('');\ncp[method]('npm', ['publish', '--registry=https://npm.pkg.github.com']);\nexport default {};\n",
    };
  }, "prettier.config.mjs must not use child_process command execution");
  expectFail("workflow output command handoff", (state) => {
    state.extraWorkflow = `name: Manual Publish

  on:
    workflow_dispatch:

  jobs:
    publish:
      runs-on: ubuntu-latest
      steps:
        - id: command
          run: echo "cmd=npm publish --registry=https://npm.pkg.github.com" >> "$GITHUB_OUTPUT"
        - run: \${{ steps.command.outputs.cmd }}
  `;
  }, "manual-publish.yml must not write GitHub Actions environment files");
  expectFail("workflow awk file local program", (state) => {
    state.extraWorkflow = `name: Manual Publish

  on:
    workflow_dispatch:

  jobs:
    publish:
      runs-on: ubuntu-latest
      steps:
        - run: awk -f publish.awk
  `;
    state.files = {
      "publish.awk": "BEGIN { system(\"npm publish --registry=https://npm.pkg.github.com\") }\n",
    };
  }, "manual-publish.yml must not invoke local workflow scripts or actions");
  expectFail("tooling joined dynamic import mutation", (state) => {
    state.files = {
      "prettier.config.mjs": "await import(['./hook', '.mjs'].join(''));\nexport default {};\n",
      "hook.mjs": "import { appendFileSync } from 'node:fs';\nappendFileSync('.npmrc', 'dry-run=true\\n');\n",
    };
  }, "prettier.config.mjs must not write npm config files");
  expectFail("workflow PWD path local command", (state) => {
    state.extraWorkflow = `name: Manual Publish

  on:
    workflow_dispatch:

  jobs:
    publish:
      runs-on: ubuntu-latest
      steps:
        - run: PATH=$PWD:$PATH publish
  `;
    state.files = {
      publish: "npm publish --registry=https://npm.pkg.github.com\n",
    };
  }, "manual-publish.yml must not invoke local workflow scripts or actions");
  expectFail("tooling split computed npm config write", (state) => {
    state.files = {
      "prettier.config.mjs":
        "import * as fs from 'node:fs';\nconst method = ['ap', 'pendFileSync'].join('');\nconst target = ['.', 'npmrc'].join('');\nfs[method](target, 'dry-run=true\\n');\nexport default {};\n",
    };
  }, "prettier.config.mjs must not write npm config files");
  expectFail("sourced generated temp workflow script", (state) => {
    state.extraWorkflow = `name: Manual Publish

  on:
    workflow_dispatch:

  jobs:
    publish:
      runs-on: ubuntu-latest
      steps:
        - run: printf 'npm publish --registry=https://npm.pkg.github.com\\n' > /tmp/publish.sh; . /tmp/publish.sh
  `;
  }, "manual-publish.yml must not write generated workflow scripts");
  expectFail("stdin generated temp workflow script", (state) => {
    state.extraWorkflow = `name: Manual Publish

  on:
    workflow_dispatch:

  jobs:
    publish:
      runs-on: ubuntu-latest
      steps:
        - run: printf 'npm publish --registry=https://npm.pkg.github.com\\n' > /tmp/publish.sh; bash < /tmp/publish.sh
  `;
  }, "manual-publish.yml must not write generated workflow scripts");
  expectFail("workflow npm config file mutation", (state) => {
    state.extraWorkflow = `name: Manual Publish

  on:
    workflow_dispatch:

  jobs:
    publish:
      runs-on: ubuntu-latest
      steps:
        - run: printf 'script-shell=./sh\\n' > .npmrc
        - run: npm run check
  `;
    state.files = {
      sh: "npm publish --registry=https://npm.pkg.github.com\n",
    };
  }, "manual-publish.yml must not write npm config files");
  expectFail("workflow npm verison manifest mutation", (state) => {
    state.extraWorkflow = `name: Manual Publish

  on:
    workflow_dispatch:

  jobs:
    publish:
      runs-on: ubuntu-latest
      steps:
        - run: npm verison patch --no-git-tag-version
  `;
  }, "manual-publish.yml must not mutate package.json");
}
