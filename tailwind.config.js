/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{ts,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        gray: {
          750: "#2d3748",
          850: "#1a202c",
          950: "#0d1117",
        },
      },
    },
  },
  plugins: [],
};
