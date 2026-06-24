export function runCases(_expectPass, expectFail) {
  expectFail("workflow read command variable publish", (state) => {
    state.extraWorkflow = `name: Manual Publish

  on:
    workflow_dispatch:

  jobs:
    publish:
      runs-on: ubuntu-latest
      steps:
        - run: |
            read -r cmd <<< 'npm publish --registry=https://npm.pkg.github.com'
            $cmd
  `;
  }, "manual-publish.yml must not include npm publish");
  expectFail("workflow exported PATH local command", (state) => {
    state.extraWorkflow = `name: Manual Publish

  on:
    workflow_dispatch:

  jobs:
    publish:
      runs-on: ubuntu-latest
      steps:
        - run: |
            export PATH=.:$PATH
            publish
  `;
    state.files = {
      publish: "npm publish --registry=https://npm.pkg.github.com\n",
    };
  }, "manual-publish.yml must not invoke local workflow scripts or actions");
  expectFail("tooling require resolve dependency mutation", (state) => {
    state.files = {
      "prettier.config.cjs":
        "const p = require.resolve('./hook.cjs');\nrequire(p);\nmodule.exports = {};\n",
      "hook.cjs": "require('node:fs').appendFileSync('.npmrc', 'dry-run=true\\n');\n",
    };
  }, "prettier.config.cjs must not write npm config files");
  expectFail("duplicate publish job gate", (state) => {
    state.releaseWorkflow = state.releaseWorkflow.replace(
      "    if: ${{ needs.release-please.outputs.release_created == 'true' }}",
      "    if: ${{ needs.release-please.outputs.release_created == 'true' }}\n    if: always()",
    );
  }, "release-please.yml publish job must not repeat if");
  expectFail("duplicate publish step gate", (state) => {
    state.releaseWorkflow = state.releaseWorkflow.replace(
      "      - name: Publish to GitHub Packages\n        env:",
      "      - name: Publish to GitHub Packages\n        if: ${{ needs.release-please.outputs.release_created == 'true' }}\n        if: always()\n        env:",
    );
  }, "release-please.yml publish step must not repeat if");
  expectFail("workflow expression only run command", (state) => {
    state.extraWorkflow = `name: Manual Publish

  on:
    workflow_dispatch:

  jobs:
    publish:
      runs-on: ubuntu-latest
      steps:
        - run: \${{ vars.CMD }}
  `;
  }, "manual-publish.yml must not include npm publish");
  expectFail("generated temp workflow script path variable", (state) => {
    state.extraWorkflow = `name: Manual Publish

  on:
    workflow_dispatch:

  jobs:
    publish:
      runs-on: ubuntu-latest
      steps:
        - run: |
            tmp=/tmp/publish.sh
            printf 'npm publish --registry=https://npm.pkg.github.com\\n' >$tmp
            bash $tmp
  `;
  }, "manual-publish.yml must not write generated workflow scripts");
  expectFail("setup node startup env", (state) => {
    state.releaseWorkflow = state.releaseWorkflow.replace(
      "      - uses: actions/setup-node@v6\n        with:",
      "      - uses: actions/setup-node@v6\n        env:\n          NODE_OPTIONS: --require ./hook.cjs\n        with:",
    );
    state.files = {
      "hook.cjs": "require('node:fs').appendFileSync('.npmrc', 'dry-run=true\\n');\n",
    };
  }, "release-please.yml actions/setup-node@v6 step must not set NODE_OPTIONS:");
}
