import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
 
const config = [
  ...nextCoreWebVitals,
  {
    rules: {
      '@next/next/no-img-element': 'off',
    },
  },
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "dist/**",
      "build/**",
      "coverage/**",
      "test-results/**",
      "playwright-report/**",
      "ownership-map-out/**",
      "qa_screenshots/**",
      "migration-data/**",
      "public/**",
      "supabase/**",
      ".cache/**",
    ],
  },
];

export default config;
