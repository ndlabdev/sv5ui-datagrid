import tailwindcss from '@tailwindcss/vite'
import { sveltekit } from '@sveltejs/kit/vite'
import { playwright } from '@vitest/browser-playwright'
import { defineConfig } from 'vitest/config'

export default defineConfig({
    plugins: [tailwindcss(), sveltekit()],

    resolve: process.env.VITEST ? { conditions: ['browser'] } : undefined,

    test: {
        expect: { requireAssertions: true },
        projects: [
            {
                extends: true,
                test: {
                    name: 'unit',
                    environment: 'node',
                    // `scripts/` ships nothing, but a release that misreads CI
                    // or miscounts a version is expensive in its own way, so
                    // the parts of it that can be tested are.
                    include: ['src/**/*.{test,spec}.{js,ts}', 'scripts/**/*.test.{js,mjs,ts}'],
                    exclude: [
                        'src/**/*.svelte.{test,spec}.{js,ts}',
                        'src/benchmarks/**/*.{test,spec}.{js,ts}'
                    ]
                }
            },
            {
                // Budgets rather than benchmarks: each one asserts a ceiling,
                // so a regression fails rather than being noted in a number
                // nobody reads. Serial, because two of them racing on one
                // machine is what makes a timing test flake.
                extends: true,
                test: {
                    name: 'benchmarks',
                    environment: 'node',
                    include: ['src/benchmarks/**/*.{test,spec}.{js,ts}'],
                    fileParallelism: false
                }
            },
            {
                extends: true,
                test: {
                    name: 'browser',
                    include: ['src/**/*.svelte.{test,spec}.{js,ts}'],
                    setupFiles: ['./src/tests/setup.browser.ts'],
                    browser: {
                        enabled: true,
                        headless: true,
                        provider: playwright(),
                        instances: [{ browser: 'chromium' }]
                    }
                }
            }
        ]
    }
})
