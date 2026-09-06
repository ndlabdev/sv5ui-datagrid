import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-svelte'
import { page } from 'vitest/browser'
import FeatureLayers from './FeatureLayers.svelte'

/**
 * What `GridFeature.component` is for. Neither of the two things checked here
 * is reachable by importing anything from `DataGrid`: the layer is named by
 * the feature the app registered, and the panel takes the grid out of context
 * rather than off a prop.
 */
describe('a feature that contributes a component', () => {
    it('mounts the layer into the grid root, once per grid', async () => {
        render(FeatureLayers as never)
        await expect.element(page.getByRole('treegrid')).toBeVisible()

        // `rangeSelection()` contributes `RangeLayer`, which draws nothing and
        // marks the root it listens on.
        await expect.poll(() => document.querySelectorAll('[data-dg-range-layer]').length).toBe(1)
    })

    it('draws a chrome part that was never handed a grid', async () => {
        render(FeatureLayers as never)
        // `GroupPanel` takes no `grid` prop and no `ui`: the grid comes from
        // the context `Grid.Root` set, and the wording from that grid's own
        // labels rather than from a table of its own.
        const panel = () => document.querySelector('[data-dg-group-panel]')?.textContent ?? ''
        await expect.poll(panel).toContain('Group by')
        await expect.poll(panel).toContain('No grouping')
    })
})
