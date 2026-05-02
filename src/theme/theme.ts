import Aura from '@primeuix/themes/aura';
import { definePreset } from '@primeuix/themes';

export const CustomPreset = definePreset(Aura, {
  semantic: {
    primary: {
      50: '#e6f2f2',
      100: '#cce5e5',
      200: '#99cccc',
      300: '#66b2b2',
      400: '#339999',
      500: '#008080',
      600: '#006666',
      700: '#004d4d',
      800: '#003333',
      900: '#001a1a',
      950: '#000d0d'
    },
    colorScheme: {
      light: {
        surface: {
          0: '#ffffff',
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#333333',
          900: '#0f172a',
          950: '#020617'
        }
      },
      dark: {
        surface: {
          0: '#121212',
          50: '#1e1e1e',
          100: '#2d2d2d',
          200: '#3f3f46',
          300: '#52525b',
          400: '#71717a',
          500: '#a1a1aa',
          600: '#d4d4d8',
          700: '#e4e4e7',
          800: '#f4f4f5',
          900: '#fafafa',
          950: '#ffffff'
        }
      }
    }
  }
});