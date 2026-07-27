/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./app/**/*.{js,jsx,ts,tsx}', './src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // Único ponto de cor do app. O valor vem de uma variável CSS que o
        // ThemeProvider define em tempo de execução (nativewind `vars`), para a
        // pessoa poder trocar a cor de destaque nas Configurações. O padrão é o
        // rosa da marca — ver theme/tokens.ts.
        accent: {
          DEFAULT: 'var(--accent)',
          soft: 'var(--accent-soft)',
          softdark: 'var(--accent-softdark)',
        },
        canvas: {
          light: '#FFFFFF',
          dark: '#000000',
        },
        surface: {
          light: '#FFFFFF',
          dark: '#0E0E0F',
        },
        // Preenchimento neutro: inputs, chips, blocos de código, estado pressionado.
        subtle: {
          light: '#F4F4F5',
          dark: '#1A1A1C',
        },
        ink: {
          light: '#0A0A0A',
          dark: '#FAFAFA',
        },
        muted: {
          light: '#8A8A8E',
          dark: '#8E8E93',
        },
        hairline: {
          light: '#E7E7E9',
          dark: '#212123',
        },
        danger: '#E5484D',
      },
    },
  },
  plugins: [],
};
