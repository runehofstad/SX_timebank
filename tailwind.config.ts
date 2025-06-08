import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: 'class',
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
        card: {
          DEFAULT: "var(--card)",
          foreground: "var(--card-foreground)",
        },
        popover: {
          DEFAULT: "var(--popover)",
          foreground: "var(--popover-foreground)",
        },
        primary: {
          DEFAULT: "var(--primary)",
          foreground: "var(--primary-foreground)",
        },
        secondary: {
          DEFAULT: "var(--secondary)",
          foreground: "var(--secondary-foreground)",
        },
        muted: {
          DEFAULT: "var(--muted)",
          foreground: "var(--muted-foreground)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          foreground: "var(--accent-foreground)",
        },
        destructive: {
          DEFAULT: "var(--destructive)",
          foreground: "var(--destructive-foreground)",
        },
        border: "var(--border)",
        input: "var(--input)",
        ring: "var(--ring)",
        sidebar: {
          bg: "var(--sidebar-bg)",
          border: "var(--sidebar-border)",
          text: "var(--sidebar-text)",
          hover: "var(--sidebar-hover)",
        },
        'studio-x': {
          DEFAULT: '#d1275a',
          50: '#FFE5EC',
          100: '#FFB8CC',
          200: '#FF8AAC',
          300: '#FF5C8C',
          400: '#FF2E6C',
          500: '#d1275a',
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
