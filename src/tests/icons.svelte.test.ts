import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-svelte'
import AllIcons from './AllIcons.svelte'
import { datagridIcons } from '../lib/components/internal/icons.data.js'

describe('grid icons render offline', () => {
    it('resolves every bundled icon from the store, not the network', async () => {
        render(AllIcons)
        // A synchronous render is only possible from the local store; a fetch
        // would leave the span empty on this tick.
        await new Promise((r) => setTimeout(r, 100))

        const empties: string[] = []
        for (const name of Object.keys(datagridIcons.icons)) {
            const svg = document.querySelector(`[data-icon="${name}"] svg`)
            if (!svg || svg.innerHTML.trim() === '') empties.push(name)
        }
        expect(empties).toEqual([])
    })
})
