export function runCases(expectPass, expectFail) {
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
}
