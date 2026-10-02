/**
 * Общий дизайн-токен-пресет (Mini App + Admin).
 * Цвета бренда: #0E7A5A (зелёный), #C4A15A (золото), #FAF7F2 (бежевый фон).
 */
/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['class'],
  theme: {
    container: { center: true, padding: '1rem' },
    extend: {
      fontFamily: {
        sans: ['Manrope', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        arabic: ['Amiri', 'serif'],
      },
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: { DEFAULT: 'hsl(var(--primary))', foreground: 'hsl(var(--primary-foreground))' },
        secondary: { DEFAULT: 'hsl(var(--secondary))', foreground: 'hsl(var(--secondary-foreground))' },
        gold: { DEFAULT: 'hsl(var(--gold))', foreground: 'hsl(var(--gold-foreground))', soft: 'hsl(var(--gold-soft))' },
        destructive: { DEFAULT: 'hsl(var(--destructive))', foreground: 'hsl(var(--destructive-foreground))' },
        success: { DEFAULT: 'hsl(var(--success))' },
        muted: { DEFAULT: 'hsl(var(--muted))', foreground: 'hsl(var(--muted-foreground))' },
        accent: { DEFAULT: 'hsl(var(--accent))', foreground: 'hsl(var(--accent-foreground))' },
        card: { DEFAULT: 'hsl(var(--card))', foreground: 'hsl(var(--card-foreground))' },
        popover: { DEFAULT: 'hsl(var(--popover))', foreground: 'hsl(var(--popover-foreground))' },
        brand: { green: '#0E7A5A', gold: '#C4A15A', beige: '#FAF7F2', ink: '#14231E' },
      },
      borderRadius: {
        xl: 'calc(var(--radius) + 4px)',
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      boxShadow: {
        soft: '0 1px 2px rgba(20,35,30,.04)',
        gold: '0 1px 2px rgba(20,35,30,.04)',
      },
      backgroundImage: {
        // Исламский геометрический орнамент (8-конечная звезда), очень деликатный
        pattern:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='48' height='48' viewBox='0 0 48 48'%3E%3Cg fill='none' stroke='%23C4A15A' stroke-opacity='.16' stroke-width='1'%3E%3Crect x='14' y='14' width='20' height='20'/%3E%3Crect x='14' y='14' width='20' height='20' transform='rotate(45 24 24)'/%3E%3C/g%3E%3C/svg%3E\")",
      },
      keyframes: {
        'fade-up': { from: { opacity: '0', transform: 'translateY(6px)' }, to: { opacity: '1', transform: 'none' } },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
      },
      animation: {
        'fade-up': 'fade-up .35s ease-out both',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};
