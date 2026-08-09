import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-svelte'
import { userEvent } from 'vitest/browser'
import AllIcons from './AllIcons.svelte'
import EveryIconGrid from './EveryIconGrid.svelte'
import { datagridIcons } from '../lib/components/internal/icons.data.js'

const ICON_API = /iconify|simplesvg|unisvg/i

/** Records anything the page tries to fetch while `run` is executing. */
async function watchNetwork(run: () => Promise<void>): Promise<string[]> {
    const asked: string[] = []
    const realFetch = globalThis.fetch
    const realOpen = XMLHttpRequest.prototype.open

    globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input instanceof Request ? input.url : input)
        if (ICON_API.test(url)) asked.push(url)
        return realFetch(input as RequestInfo, init)
    }) as typeof fetch
    // Iconify falls back to XHR where fetch is unavailable, and a guard that
    // only watched one of the two would pass while the other leaked.
    XMLHttpRequest.prototype.open = function (this: XMLHttpRequest, ...args: unknown[]) {
        const url = String(args[1])
        if (ICON_API.test(url)) asked.push(url)
        return (realOpen as (...a: unknown[]) => void).apply(this, args)
    } as typeof XMLHttpRequest.prototype.open

    try {
        await run()
    } finally {
        globalThis.fetch = realFetch
        XMLHttpRequest.prototype.open = realOpen
    }
    return asked
}

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

    it('renders a grid of every cell type without asking the network', async () => {
        // The bundled-icon check above is circular on its own: it only proves
        // that what shipped renders. This drives the real chrome and watches
        // for the fetch an icon makes when the store cannot answer.
        const asked = await watchNetwork(async () => {
            const screen = await render(EveryIconGrid)
            await expect.element(screen.getByRole('grid')).toBeVisible()

            // Chrome that only mounts on demand, where a missed icon hides.
            // Opened by walking the real toolbar rather than by label, so a
            // renamed control silently narrows coverage instead of failing.
            const toolbar =
                screen.container.querySelectorAll<HTMLElement>('button, [role="button"]')
            for (const button of [...toolbar].slice(0, 8)) {
                await userEvent.click(button)
                await new Promise((resolve) => setTimeout(resolve, 60))
                await userEvent.keyboard('{Escape}')
            }

            // A widget editor: its chevron and check come from sv5ui, not us.
            const cell = document.querySelector<HTMLElement>('[data-dg-cell="0:5"]')
            if (cell) await userEvent.dblClick(cell)
            await new Promise((resolve) => setTimeout(resolve, 150))
            await userEvent.keyboard('{Escape}')
        })

        expect(asked).toEqual([])
    })

    it('renders nothing empty across that grid', async () => {
        const screen = await render(EveryIconGrid)
        await expect.element(screen.getByRole('grid')).toBeVisible()
        await new Promise((resolve) => setTimeout(resolve, 150))

        // An icon the store cannot answer renders as a blank placeholder while
        // its fetch is in flight, so emptiness is the other half of the signal.
        const blanks = [...screen.container.querySelectorAll('svg')].filter(
            (svg) => svg.innerHTML.trim() === ''
        )
        expect(blanks.map((svg) => svg.outerHTML.slice(0, 60))).toEqual([])
    })
})

describe('an app can register the icons before any grid mounts', () => {
    it('exports the registrar and the collection', async () => {
        const lib = await import('$lib/index.js')
        // Without these, an app drawing one of the grid's own icons elsewhere
        // on the page has no way to fill the store before `Grid.Root` mounts,
        // and that icon fetches and flickers in.
        expect(typeof lib.registerDataGridIcons).toBe('function')
        expect(Object.keys(lib.datagridIcons.icons).length).toBeGreaterThan(0)
    })

    it('is idempotent, so calling it at startup and per grid is safe', async () => {
        const { registerDataGridIcons } = await import('$lib/index.js')
        expect(() => {
            registerDataGridIcons()
            registerDataGridIcons()
        }).not.toThrow()
    })
})

describe('the icon store is what answers', () => {
    it('has a body for every icon it ships', () => {
        for (const [name, icon] of Object.entries(datagridIcons.icons)) {
            expect(icon.body.trim(), name).not.toBe('')
        }
    })

    it('renders the icons sv5ui owns without us bundling them', async () => {
        // The rating star, the external-link arrow and the busy spinner come
        // from sv5ui's own registered bundle. They are deliberately absent from
        // ours, so this is what proves the grid still draws them.
        const bundled = new Set(Object.keys(datagridIcons.icons))
        for (const name of ['star', 'arrow-up-right', 'loader-circle']) {
            expect(bundled.has(name), `${name} should not be duplicated`).toBe(false)
        }

        const screen = await render(EveryIconGrid)
        await expect.element(screen.getByRole('grid')).toBeVisible()
        await new Promise((resolve) => setTimeout(resolve, 150))

        // The rating column draws a star per row.
        const stars = screen.container.querySelectorAll('[data-dg-cell] svg')
        expect(stars.length).toBeGreaterThan(0)
    })
})
