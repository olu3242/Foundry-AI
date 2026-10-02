import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) });

const config = [
  { ignores: ["next-env.d.ts", ".next/**", "node_modules/**", "supabase/functions/**", "public/sw.js", "public/assets/**", "lib/supabase/database.types.ts"] },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  { files: ["app/(marketing)/page.tsx"], rules: { "@next/next/no-css-tags": "off" } },
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },
];
export default config;
