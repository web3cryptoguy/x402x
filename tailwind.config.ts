import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        press: ["var(--font-press)", "cursive"],
        vt323: ["var(--font-vt323)", "monospace"],
      },
      animation: {
        float: "float 3s ease-in-out infinite",
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-10px)" },
        },
      },
      boxShadow: {
        "pixel": "4px 4px 0 rgba(0,0,0,0.2)",
        "pixel-sm": "2px 2px 0 rgba(0,0,0,0.2)",
      },
    },
  },
  plugins: [],
};
export default config;

