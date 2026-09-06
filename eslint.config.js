import prettier from 'eslint-config-prettier'
import { fileURLToPath } from 'node:url'
import { includeIgnoreFile } from '@eslint/compat'
import js from '@eslint/js'
import svelte from 'eslint-plugin-svelte'
import { defineConfig } from 'eslint/config'
import globals from 'globals'
import ts from 'typescript-eslint'
import svelteConfig from './svelte.config.js'

const gitignorePath = fileURLToPath(new URL('./.gitignore', import.meta.url))

export default defineConfig(
    includeIgnoreFile(gitignorePath),
    js.configs.recommended,
    ...ts.configs.recommended,
    ...svelte.configs.recommended,
    prettier,
    ...svelte.configs.prettier,
    {
        languageOptions: { globals: { ...globals.browser, ...globals.node } },

        rules: {
            'no-undef': 'off',
            semi: ['error', 'never'],
            indent: 'off',
            quotes: ['error', 'single', { avoidEscape: true }],
            'comma-dangle': ['error', 'never'],
            eqeqeq: ['error', 'always'],
            'no-empty': ['error', { allowEmptyCatch: true }],
            'no-console': 'warn',
            'no-unused-vars': 'off',
            // A leading underscore is how this codebase says a binding is
            // deliberately unread: an `#each` that needs the index and not the
            // item, a handler that takes an event it ignores.
            '@typescript-eslint/no-unused-vars': [
                'error',
                { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }
            ],
            'quote-props': ['error', 'as-needed'],
            'max-params': ['warn', 4],
            complexity: ['warn', 10]
        }
    },
    {
        files: ['scripts/**'],
        rules: {
            'no-console': 'off'
        }
    },
    {
        // Escaping control characters is what this module is for: they are
        // legal in a cell and illegal in the XML the sheet is written as.
        files: ['src/lib/features/xlsx/**'],
        rules: {
            'no-control-regex': 'off'
        }
    },
    {
        files: ['**/*.svelte', '**/*.svelte.ts', '**/*.svelte.js'],

        languageOptions: {
            parserOptions: {
                projectService: true,
                extraFileExtensions: ['.svelte'],
                parser: ts.parser,
                svelteConfig
            }
        }
    }
)
