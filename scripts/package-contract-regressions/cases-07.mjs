export function runCases(_expectPass, expectFail) {
  expectFail("check workflow plain scalar run continuation", (state) => {
    state.checkWorkflow = state.checkWorkflow.replace(
      "        run: npm run check",
      "        run: npm run check\n          || true",
    );
  }, "check.yml must include exact run: npm run check in a step");
  expectFail("release publish plain scalar run continuation", (state) => {
    state.releaseWorkflow = state.releaseWorkflow.replace(
      "        run: npm publish --registry=https://npm.pkg.github.com",
      "        run: npm publish --registry=https://npm.pkg.github.com\n          --dry-run",
    );
  }, "release-please.yml must include run: npm publish --registry=https://npm.pkg.github.com in a job");
  expectFail("duplicate audited uses key", (state) => {
    state.checkWorkflow = state.checkWorkflow.replace(
      "      - uses: actions/checkout@v6",
      "      - uses: actions/checkout@v6\n        uses: ./local-action",
    );
  }, "check.yml step must not repeat uses");
  expectFail("smoke eval static import", (state) => {
    state.packageJson.scripts["smoke:dist"] =
      "node --input-type=module --eval \"import 'data:text/javascript,console.log(1)'; await import('./dist/index.js')\"";
  }, "script smoke:dist must match an audited dist smoke template");
  expectFail("workflow markerless expression command", (state) => {
    state.extraWorkflow = `name: Manual Publish

  on:
    workflow_dispatch:

  jobs:
    publish:
      runs-on: ubuntu-latest
      steps:
        - run: \${{ secrets.CMD }}
  `;
  }, "manual-publish.yml must not include npm publish");
  expectFail("duplicate check job definition", (state) => {
    state.checkWorkflow += `

  check:
    runs-on: ubuntu-latest
    steps:
      - run: true
`;
  }, "check.yml jobs block must include exactly one check:");
  expectFail("npmrc duplicate registry uses last entry", (state) => {
    state.files = {
      ".npmrc": "registry=https://npm.pkg.github.com\nregistry=https://registry.npmjs.org\n",
    };
  }, ".npmrc registry must be https://npm.pkg.github.com");
  expectFail("workflow mv npm config mutation", (state) => {
    state.extraWorkflow = `name: Manual Publish

  on:
    workflow_dispatch:

  jobs:
    publish:
      runs-on: ubuntu-latest
      steps:
        - run: printf 'dry-run=true\\n' > tmp && mv tmp .npmrc
  `;
  }, "manual-publish.yml must not write npm config files");
  expectFail("workflow PWD local script path", (state) => {
    state.extraWorkflow = `name: Manual Publish

  on:
    workflow_dispatch:

  jobs:
    publish:
      runs-on: ubuntu-latest
      steps:
        - run: bash $PWD/publish.sh
  `;
    state.files = {
      "publish.sh": "npm publish --registry=https://npm.pkg.github.com\n",
    };
  }, "manual-publish.yml must not invoke local workflow scripts or actions");
  expectFail("workflow mawk file local program", (state) => {
    state.extraWorkflow = `name: Manual Publish

  on:
    workflow_dispatch:

  jobs:
    publish:
      runs-on: ubuntu-latest
      steps:
        - run: mawk -f publish.awk
  `;
    state.files = {
      "publish.awk": "BEGIN { system(\"npm publish --registry=https://npm.pkg.github.com\") }\n",
    };
  }, "manual-publish.yml must not invoke local workflow scripts or actions");
  expectFail("generated runner temp subdir workflow script", (state) => {
    state.extraWorkflow = `name: Manual Publish

  on:
    workflow_dispatch:

  jobs:
    publish:
      runs-on: ubuntu-latest
      steps:
        - run: |
            mkdir -p "$RUNNER_TEMP/p"
            printf 'npm publish --registry=https://npm.pkg.github.com\\n' > "$RUNNER_TEMP/p/publish.sh"
            bash "$RUNNER_TEMP/p/publish.sh"
  `;
  }, "manual-publish.yml must not write generated workflow scripts");
}
