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
          navy:     "#003087",
          navyDark: "#001F5B",
          blue:     "#1565C0",
          blueMid:  "#1976D2",
          blueLight:"#1E88E5",
          sky:      "#E3F2FD",
          saffron:  "#FF9933",
          amber:    "#FF8F00",
          bg:       "#F0F5FB",
          border:   "#C5D8F0",
          success:  "#16A34A",
          error:    "#DC2626",
        },
      },
      fontFamily: {
        sans: ["'Noto Sans'", "'Open Sans'", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 4px rgba(0,48,135,0.08), 0 0 0 1px rgba(0,48,135,0.06)",
        "card-hover": "0 4px 16px rgba(0,48,135,0.14)",
        header: "0 2px 8px rgba(0,0,0,0.18)",
      },
    },
  },
  plugins: [require("@tailwindcss/typography")],
};

export default config;
