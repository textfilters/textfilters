export function runCases(_expectPass, expectFail) {
  expectFail("duplicate audited job runner key", (state) => {
    state.checkWorkflow = state.checkWorkflow.replace(
      "    runs-on: ubuntu-latest",
      "    runs-on: ubuntu-latest\n    runs-on: self-hosted",
    );
  }, "check.yml check job must not repeat runs-on");
  expectFail("duplicate audited step working directory key", (state) => {
    state.checkWorkflow = state.checkWorkflow.replace(
      "        run: npm run check",
      "        working-directory: .\n        working-directory: subpkg\n        run: npm run check",
    );
  }, "check.yml npm run check step must not repeat working-directory");
  expectFail("duplicate auth token env entry", (state) => {
    state.checkWorkflow = state.checkWorkflow.replace(
      "          NODE_AUTH_TOKEN: ${{ github.token }}",
      "          NODE_AUTH_TOKEN: ${{ github.token }}\n          NODE_AUTH_TOKEN: ${{ secrets.PACKAGE_TOKEN }}",
    );
  }, "check.yml step env must not repeat NODE_AUTH_TOKEN");
  expectFail("workflow install npm config mutation", (state) => {
    state.extraWorkflow = `name: Manual Publish

on:
  workflow_dispatch:

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - run: printf 'dry-run=true\\n' > tmp && install tmp .npmrc
`;
  }, "manual-publish.yml must not write npm config files");
  expectFail("workflow bash append publish command variable", (state) => {
    state.extraWorkflow = `name: Manual Publish

on:
  workflow_dispatch:

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - run: cmd=npm; cmd+=' publish --registry=https://npm.pkg.github.com'; $cmd
`;
  }, "manual-publish.yml must not include npm publish");
  expectFail("smoke eval dynamic import", (state) => {
    state.packageJson.scripts["smoke:dist"] =
      "node --input-type=module --eval \"const u = 'data:text/javascript,console.log(1)'; await import(u); await import('./dist/index.js')\"";
  }, "script smoke:dist must match an audited dist smoke template");
  expectFail("executed tooling aliased createRequire dependency", (state) => {
    state.files = {
      "prettier.config.mjs": `import { createRequire as cr } from 'node:module';

const require = cr(import.meta.url);
require('./hook.cjs');
export default {};
`,
      "hook.cjs": "require('node:fs').writeFileSync('.npmrc', 'dry-run=true\\n');\n",
    };
  }, "prettier.config.mjs must not write npm config files");
}
