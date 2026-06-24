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
}
