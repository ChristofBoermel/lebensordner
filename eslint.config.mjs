import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
 
const config = [
  ...nextCoreWebVitals,
  {
    rules: {
      '@next/next/no-img-element': 'off',
    },
  },
  {
    ignores: ["dist/**"],
  },
];

export default config;
