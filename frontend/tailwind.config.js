/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-dm)", "system-ui", "sans-serif"],
        display: ["var(--font-bricolage)", "sans-serif"],
      },
      colors: {
        brand: { 50:"#f0f4ff",100:"#dde6ff",200:"#c3d1ff",300:"#9db3ff",400:"#7490ff",500:"#4f6eff",600:"#3a52f5",700:"#2d3fe0",800:"#2535b5",900:"#23318f",950:"#151d57" },
        surface: { 0:"#ffffff",50:"#f8f8fc",100:"#f0f0f8",200:"#e4e4f0",300:"#d0d0e4" },
        ink: { DEFAULT:"#0d0d1a",secondary:"#4a4a6a",tertiary:"#8888aa",disabled:"#bbbbcc" },
      },
      boxShadow: {
        card: "0 1px 3px rgba(13,13,26,0.07), 0 4px 16px rgba(13,13,26,0.04)",
        "card-hover": "0 4px 12px rgba(13,13,26,0.1), 0 12px 32px rgba(13,13,26,0.07)",
        brand: "0 4px 20px rgba(79,110,255,0.35)",
      },
      animation: {
        "fade-in": "fadeIn 0.25s ease-out",
        "slide-up": "slideUp 0.35s cubic-bezier(0.16,1,0.3,1)",
      },
      keyframes: {
        fadeIn: { "0%": { opacity:"0" }, "100%": { opacity:"1" } },
        slideUp: { "0%": { opacity:"0",transform:"translateY(12px)" }, "100%": { opacity:"1",transform:"translateY(0)" } },
      },
    },
  },
  plugins: [],
};