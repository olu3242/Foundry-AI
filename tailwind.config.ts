import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";

const token = (name: string) => `hsl(var(--${name}) / <alpha-value>)`;

export default {
  darkMode: ["class", '[data-theme="dark"]'],
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    container: { center: true, padding: "1rem", screens: { "2xl": "1280px" } },
    extend: {
      colors: {
        background: token("background"),
        foreground: token("foreground"),
        surface: token("surface"),
        border: token("border"),
        input: token("input"),
        ring: token("ring"),
        muted: { DEFAULT: token("muted"), foreground: token("muted-foreground") },
        primary: { DEFAULT: token("primary"), foreground: token("primary-foreground") },
        destructive: { DEFAULT: token("destructive"), foreground: token("destructive-foreground") },
        // Brand semantics: green = brand/trust, growth = progress, gold = opportunity,
        // orange = intervention, navy = institutional trust, insight = AI moments only.
        brand: token("brand"),
        forest: token("forest"),
        growth: token("growth"),
        gold: { DEFAULT: token("gold"), ink: token("gold-ink") },
        orange: { DEFAULT: token("orange"), ink: token("orange-ink") },
        navy: token("navy"),
        insight: token("insight"),
      },
      borderRadius: { lg: "var(--radius)", md: "calc(var(--radius) - 4px)", sm: "calc(var(--radius) - 8px)" },
      fontFamily: { sans: ["var(--font-sans)", "system-ui", "sans-serif"] },
      boxShadow: {
        glass: "0 1px 0 0 hsl(0 0% 100% / 0.06) inset, 0 20px 40px -24px hsl(var(--shadow) / 0.55)",
        glow: "0 0 0 1px hsl(var(--growth) / 0.35), 0 8px 32px -8px hsl(var(--growth) / 0.45)",
      },
      backgroundImage: {
        aurora:
          "radial-gradient(60rem 30rem at 10% -10%, hsl(var(--brand) / 0.35), transparent 60%), radial-gradient(40rem 24rem at 90% 0%, hsl(var(--gold) / 0.12), transparent 60%)",
      },
    },
  },
  plugins: [animate],
} satisfies Config;
