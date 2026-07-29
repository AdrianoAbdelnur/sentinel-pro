import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
  {
    files: ["app/**/page.tsx", "app/**/layout.tsx"],
    rules: {
      "react-hooks/purity": "off",
    },
  },
]);

export default eslintConfig;
