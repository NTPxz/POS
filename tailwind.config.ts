import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "'Noto Sans Thai'",
          "-apple-system",
          "BlinkMacSystemFont",
          "'Segoe UI'",
          "sans-serif",
        ],
      },
      colors: {
        // สีหลักของแบรนด์ — แดงอิฐเข้ม (จาก #a21708)
        brand: {
          50: "#fdf2f1",
          100: "#fbe2df",
          200: "#f6c4bc",
          300: "#ec9a8a",
          400: "#dc6b54",
          500: "#c2402a",
          600: "#a21708",
          700: "#841206",
          800: "#6c1006",
          900: "#590f07",
        },
        // สีทอง/สีทราย — สีรอง ใช้เน้นไฮไลต์ (จาก #e0ce9d)
        sand: {
          50: "#fcfaf5",
          100: "#f8f0e0",
          200: "#efe0c0",
          300: "#e0ce9d",
          400: "#cdb173",
          500: "#b6924f",
          600: "#997640",
          700: "#7a5d35",
          800: "#644c2f",
          900: "#54402a",
        },
        // สีเทาอุ่น — แทน slate สำหรับพื้นหลัง/เส้นขอบ/ข้อความรอง (จาก #e2ddd8)
        neutral: {
          50: "#faf9f7",
          100: "#f4f2ef",
          200: "#e2ddd8",
          300: "#cec5bc",
          400: "#a89b8d",
          500: "#87796a",
          600: "#6b6053",
          700: "#544b41",
          800: "#3c352d",
          900: "#26211c",
        },
      },
      keyframes: {
        "toast-in": {
          "0%": { opacity: "0", transform: "translateY(-8px) scale(0.98)" },
          "100%": { opacity: "1", transform: "translateY(0) scale(1)" },
        },
      },
      animation: {
        "toast-in": "toast-in 0.2s ease-out",
      },
    },
  },
  plugins: [],
};
export default config;
