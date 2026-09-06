import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-svelte'

const DEMOS = [
    'aggregate',
    'auto',
    'combo',
    'fill',
    'filter',
    'filter-types',
    'find',
    'format',
    'formula',
    'import',
    'policy',
    'range',
    'share',
    'structures',
    'views',
    'worker',
    'xlsx'
] as const

describe.each(DEMOS)('the %s demo', (name) => {
    it('mounts and draws a grid', async () => {
        const page$ = (await import(`../routes/${name}/+page.svelte`)) as { default: unknown }
        render(page$.default as never)

        await expect
            .poll(() => document.querySelectorAll('[role="grid"], [role="treegrid"]').length, {
                timeout: 5_000
            })
            .toBeGreaterThan(0)
    })
})
