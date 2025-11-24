/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          light: "#3A3A3A",
          DEFAULT: "#0F0F0F",
          dark: "#050505"
        },
        secondary: {
          light: "#3DA5D9",
          DEFAULT: "#107DAC",
          dark: "#0C5A7D"
        },
        sand: {
          light: "#FFFFFF",
          DEFAULT: "#F6F6F6",
          dark: "#E8E8E8"
        },
        blue: {
          50: "#E8F4F8",
          100: "#D1E9F1",
          200: "#A3D3E3",
          300: "#75BDD5",
          400: "#47A7C7",
          500: "#107DAC",
          600: "#0D6489",
          700: "#0A4B67",
          800: "#073244",
          900: "#041922"
        },
        slate: {
          50: "#FAFAFA",
          100: "#F6F6F6",
          200: "#E8E8E8",
          300: "#D4D4D4",
          400: "#A3A3A3",
          500: "#737373",
          600: "#525252",
          700: "#404040",
          800: "#262626",
          900: "#171717"
        }
      }
    }
  },
  plugins: []
};
