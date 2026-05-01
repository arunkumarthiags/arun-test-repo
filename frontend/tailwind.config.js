/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0e1116",
        steel: "#1c2230",
        edge: "#2a3142",
        accent: "#a78bfa",
        good: "#34d399",
        bad: "#f87171",
      },
    },
  },
  plugins: [],
};
