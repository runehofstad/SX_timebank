import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        'studio-x': {
          DEFAULT: '#FF3366',
          50: '#FFE5EC',
          100: '#FFB8CC',
          200: '#FF8AAC',
          300: '#FF5C8C',
          400: '#FF2E6C',
          500: '#FF3366',
          600: '#E60A42',
          700: '#B30833',
          800: '#800625',
          900: '#4D0316'
        }
      },
    },
  },
  plugins: [],
};
export default config;
