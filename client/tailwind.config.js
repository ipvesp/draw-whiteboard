/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', "system-ui", "sans-serif"],
        display: ['"Fraunces"', "Georgia", "serif"],
      },
      colors: {
        ink: {
          DEFAULT: "#141210",
          soft: "#1f1c19",
          muted: "#78716c",
        },
        paper: {
          DEFAULT: "#faf7f2",
          dim: "#f0ebe3",
          line: "#e7e0d5",
        },
        brand: {
          DEFAULT: "#0d9488",
          light: "#2dd4bf",
          dark: "#0f766e",
        },
      },
      boxShadow: {
        frame:
          "inset 0 0 0 1px rgba(0,0,0,0.06), 0 4px 24px rgba(0,0,0,0.12)",
        dock: "0 -4px 24px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.04)",
        rail: "4px 0 24px rgba(0,0,0,0.15)",
      },
    },
  },
  plugins: [],
};
