/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        ink: "#F7FAFC",
        parchment: "#44576A",
        ember: "#B7CDE3",
        dusk: "#D9E7F3",
        mist: "#6E8499",
        surface: "#EEF5FA",
        card: "#D9E7F3",
        primaryBlue: "#B7CDE3",
        secondaryBlue: "#C7DDEE",
        accentBlue: "#AFC8DE",
        borderSoft: "#E6EDF5",
        textPrimary: "#44576A",
        textSecondary: "#6E8499",
        whiteSoft: "#FFFFFF",
      },
      fontFamily: {
        display: ["var(--font-display)", "serif"],
        body: ["var(--font-body)", "sans-serif"],
      },
      keyframes: {
        lightleak: {
          "0%": { opacity: "0", transform: "translateX(-10%)" },
          "40%": { opacity: "0.35" },
          "100%": { opacity: "0", transform: "translateX(110%)" },
        },
        surface: {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        lightleak: "lightleak 2.4s ease-out 0.3s 1",
        surface: "surface 0.8s cubic-bezier(0.16,1,0.3,1) forwards",
      },
    },
  },
  plugins: [],
};
