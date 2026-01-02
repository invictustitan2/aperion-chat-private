/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      // Aperion Design Tokens
      colors: {
        // Primary/Accent (Emerald/Teal gradient)
        primary: {
          50: "#f0fdfa",
          100: "#ccfbf1",
          200: "#99f6e4",
          300: "#5eead4",
          400: "#2dd4bf",
          500: "#10b981", // Main brand color
          600: "#0d9488",
          700: "#0f766e",
          800: "#115e59",
          900: "#134e4a",
        },
        // Accent for streaming/special states
        accent: {
          purple: "#a855f7",
          pink: "#ec4899",
          blue: "#3b82f6",
        },
        // Semantic colors
        success: "#10b981",
        warning: "#f59e0b",
        error: "#ef4444",
        info: "#3b82f6",
      },
      spacing: {
        // Extended spacing for cockpit-style layouts
        18: "4.5rem",
        88: "22rem",
        112: "28rem",
        128: "32rem",
      },
      fontFamily: {
        // Maintain system fonts but allow for future customization
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
      },
      fontSize: {
        // Custom sizes for UI labels
        "2xs": "0.625rem", // 10px for metadata
      },
      animation: {
        "fade-in": "fadeIn 0.2s ease-in",
        "slide-up": "slideUp 0.3s ease-out",
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { transform: "translateY(10px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
      },
    },
  },
  plugins: [],
};
