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
          0: '#fcfaf5',
          50: '#f5f2eb',
          100: '#ebe5da',
          200: '#d4cec4',
          300: '#b8b2a6',
          400: '#9c9588',
          500: '#7d776b',
          600: '#5e5950',
          700: '#3f3b35',
          800: '#2c2820',
          900: '#1a1814',
          950: '#0d0c0a'
        }
      },
      dark: {
        surface: {
          0: '#1c1a17',
          50: '#242220',
          100: '#2d2a26',
          200: '#3a3732',
          300: '#4a4640',
          400: '#5c5850',
          500: '#7d776b',
          600: '#9c9588',
          700: '#b8b2a6',
          800: '#d4cec4',
          900: '#ebe5da',
          950: '#f5f2eb'
        }
      }
    }
  }
});