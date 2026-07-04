import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'
import prettier from 'eslint-config-prettier'

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Turn off stylistic rules that conflict with Prettier (formatting is Prettier's job).
  prettier,
  // Doc 12 §8.3: user content must never be rendered via dangerouslySetInnerHTML.
  // The single documented exemption (JSON-LD on listing detail) gets a scoped
  // eslint-disable with a comment referencing docs/12-security/README.md §8.3.
  {
    rules: {
      'react/no-danger': 'error',
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores(['.next/**', 'out/**', 'build/**', 'next-env.d.ts', 'node_modules/**']),
])

export default eslintConfig
