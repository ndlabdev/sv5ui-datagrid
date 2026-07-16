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
                    include: ['src/**/*.{test,spec}.{js,ts}'],
                    exclude: ['src/**/*.svelte.{test,spec}.{js,ts}']
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
