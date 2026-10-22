import defaultTheme from "tailwindcss/defaultTheme";
import tailwindcssAnimate from "tailwindcss-animate";

const status = (name) => ({
  DEFAULT: `hsl(var(--status-${name}))`,
  foreground: `hsl(var(--status-${name}-foreground))`,
});

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    container: {
      center: true,
      padding: "1rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        sans: ['"Archivo Variable"', ...defaultTheme.fontFamily.sans],
        // Headings and service numbers.
        display: ['"Big Shoulders Display Variable"', '"Arial Narrow"', ...defaultTheme.fontFamily.sans],
      },
      fontSize: {
        // A page's title, in the display face.
        title: ["2.125rem", { lineHeight: "1", fontWeight: "800" }],
      },
      colors: {
        bar: "hsl(var(--bar))",
        emphasis: "hsl(var(--emphasis))",
        status: {
          received: status("received"),
          "in-progress": status("in-progress"),
          completed: status("completed"),
          delivered: status("delivered"),
          cancelled: status("cancelled"),
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      // One small radius on everything (ADR-0005).
      borderRadius: {
        lg: "var(--radius)",
        md: "var(--radius)",
        sm: "var(--radius)",
      },
      keyframes: {
        // A bar a third as wide as its track, sweeping across it.
        progress: {
          from: { transform: "translateX(-100%)" },
          to: { transform: "translateX(300%)" },
        },
        // A row or card whose status just changed: its yellow edge flashes once.
        flash: {
          from: {
            boxShadow: "inset 6px 0 0 hsl(var(--primary))",
            backgroundColor: "hsl(var(--primary) / 0.3)",
          },
        },
      },
      animation: {
        progress: "progress 1.2s ease-in-out infinite",
        flash: "flash 300ms ease-out",
      },
      transitionTimingFunction: {
        // Sharp ease-out: fast and mechanical.
        snap: "cubic-bezier(0.2, 0.9, 0.3, 1)",
      },
    },
  },
  plugins: [tailwindcssAnimate],
};
