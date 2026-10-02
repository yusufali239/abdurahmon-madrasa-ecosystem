/** @type {import('tailwindcss').Config} */
module.exports = {
  presets: [require('../shared/tailwind-preset.cjs')],
  content: ['./index.html', './src/**/*.{ts,tsx}', '../shared/ui/**/*.{ts,tsx}'],
};
