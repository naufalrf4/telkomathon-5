/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  darkMode: 'class',
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#CC0000',
          dark: '#990000',
          light: '#FF4444',
        },
        secondary: '#1A1A1A',
        surface: '#FFFFFF',
      },
    },
  },
  plugins: [],
}
