import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-svelte'
import { page } from 'vitest/browser'
import FeatureLayers from './fixtures/FeatureLayers.svelte'

describe('a feature that contributes a component', () => {
    it('mounts the layer into the grid root, once per grid', async () => {
        render(FeatureLayers as never)
        await expect.element(page.getByRole('treegrid')).toBeVisible()

        await expect.poll(() => document.querySelectorAll('[data-dg-range-layer]').length).toBe(1)
    })

    it('draws a chrome part that was never handed a grid', async () => {
        render(FeatureLayers as never)
        const panel = () => document.querySelector('[data-dg-group-panel]')?.textContent ?? ''
        await expect.poll(panel).toContain('Group by')
        await expect.poll(panel).toContain('No grouping')
    })
})
