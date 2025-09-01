/** @type {import('tailwindcss').Config} */
import { colors } from './src/tailwind/color.js';
import { fontSize } from './src/tailwind/fontSizes.js';
import { fontFamily } from './src/tailwind/fontFamilies.js'; // ✅ add this line

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      colors,
      fontSize,
      fontFamily, // ✅ inject here
    }
  },
  plugins: []
}
