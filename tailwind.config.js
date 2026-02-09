/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}", "./lib/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        blackpill: {
          muted: "#72838c",
          discord: "#5865F2",
        },
      },
    },
  },
  // Prevent utility collisions with the existing app (e.g. `.container`).
  important: ".bp",
  corePlugins: {
    // We keep the existing app styles untouched; scope any needed base styles ourselves under `.bp`.
    preflight: false,
  },
};

