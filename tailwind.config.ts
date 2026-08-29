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
          navy:     "#8B1060",
          navyDark: "#5C0A3E",
          blue:     "#C9A227",
          blueMid:  "#B8911F",
          blueLight:"#D4B84A",
          sky:      "#F8F5FC",
          saffron:  "#8B1A1A",
          amber:    "#A52020",
          bg:       "#F0F2F5",
          border:   "#D1D9E6",
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
