import eslint from '@eslint/js';
import eslintPluginSvelte from 'eslint-plugin-svelte';
import eslintConfigPrettier from 'eslint-config-prettier';
import svelteParser from 'svelte-eslint-parser';

// Globals del navegador que usa el bundle del telescopio. No hay paquete
// `globals` en el árbol, así que la lista se mantiene a mano: al usar una API
// del navegador nueva, sumarla aquí.
const browserGlobals = {
  window: 'readonly',
  document: 'readonly',
  console: 'readonly',
  setTimeout: 'readonly',
  clearTimeout: 'readonly',
  setInterval: 'readonly',
  clearInterval: 'readonly',
};

export default [
  // Configuración recomendada para JavaScript general
  eslint.configs.recommended,

  // Configuración específica para archivos .svelte
  ...eslintPluginSvelte.configs['flat/recommended'],

  // Opciones de lenguaje comunes a .js y .svelte
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: browserGlobals,
    },
  },

  {
    files: ['**/*.svelte'],
    languageOptions: {
      parser: svelteParser,
    },
  },

  // Desactiva reglas de ESLint que entren en conflicto con Prettier (Siempre al final)
  eslintConfigPrettier,

  // Reglas personalizadas e ignorar carpetas de compilación
  {
    ignores: ['.svelte-kit/', 'dist/', 'node_modules/', 'lib/', 'viewer/'],
    rules: {
      // Añadir o sobrescribir reglas específicas
      'no-console': 'warn',
    },
  },
];
