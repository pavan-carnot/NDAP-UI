import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ndap: {
          navy:     "#1a1a1a",
          navyDark: "#111111",
          blue:     "#F47920",
          blueMid:  "#E8671A",
          blueLight:"#FF8C42",
          sky:      "#FFF8F2",
          saffron:  "#FF9933",
          amber:    "#FF8F00",
          bg:       "#F9F9F9",
          border:   "#E5E5E5",
          success:  "#16A34A",
          error:    "#DC2626",
        },
      },
      fontFamily: {
        sans: ["'Noto Sans'", "'Open Sans'", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 4px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.04)",
        "card-hover": "0 4px 16px rgba(0,0,0,0.12)",
        header: "0 2px 8px rgba(0,0,0,0.18)",
      },
    },
  },
  plugins: [require("@tailwindcss/typography")],
};

export default config;
