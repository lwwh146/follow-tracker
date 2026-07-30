/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          xhs: '#ff2442',  // Red Note Red
          dy: '#060309',   // TikTok dark/cyan/pink
          bili: '#fb7299', // Bilibili Pink
        }
      }
    },
  },
  plugins: [],
}
