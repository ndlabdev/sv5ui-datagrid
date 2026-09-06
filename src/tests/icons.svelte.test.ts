import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-svelte'
import { userEvent } from 'vitest/browser'
import AllIcons from './fixtures/AllIcons.svelte'
import EveryIconGrid from './fixtures/EveryIconGrid.svelte'
import { datagridIcons } from '../lib/components/internal/icons.data.js'

const ICON_API = /iconify|simplesvg|unisvg/i

async function watchNetwork(run: () => Promise<void>): Promise<string[]> {
    const asked: string[] = []
    const realFetch = globalThis.fetch
    const realOpen = XMLHttpRequest.prototype.open

    globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input instanceof Request ? input.url : input)
        if (ICON_API.test(url)) asked.push(url)
        return realFetch(input as RequestInfo, init)
    }) as typeof fetch
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
        await new Promise((r) => setTimeout(r, 100))

        const empties: string[] = []
        for (const name of Object.keys(datagridIcons.icons)) {
            const svg = document.querySelector(`[data-icon="${name}"] svg`)
            if (!svg || svg.innerHTML.trim() === '') empties.push(name)
        }
        expect(empties).toEqual([])
    })

    it('renders a grid of every cell type without asking the network', async () => {
        const asked = await watchNetwork(async () => {
            const screen = await render(EveryIconGrid)
            await expect.element(screen.getByRole('grid')).toBeVisible()

            const toolbar =
                screen.container.querySelectorAll<HTMLElement>('button, [role="button"]')
            for (const button of [...toolbar].slice(0, 8)) {
                await userEvent.click(button)
                await new Promise((resolve) => setTimeout(resolve, 60))
                await userEvent.keyboard('{Escape}')
            }

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

        const blanks = [...screen.container.querySelectorAll('svg')].filter(
            (svg) => svg.innerHTML.trim() === ''
        )
        expect(blanks.map((svg) => svg.outerHTML.slice(0, 60))).toEqual([])
    })
})

describe('an app can register the icons before any grid mounts', () => {
    it('exports the registrar and the collection', async () => {
        const lib = await import('$lib/index.js')
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
        const bundled = new Set(Object.keys(datagridIcons.icons))
        for (const name of ['star', 'arrow-up-right', 'loader-circle']) {
            expect(bundled.has(name), `${name} should not be duplicated`).toBe(false)
        }

        const screen = await render(EveryIconGrid)
        await expect.element(screen.getByRole('grid')).toBeVisible()
        await new Promise((resolve) => setTimeout(resolve, 150))

        const stars = screen.container.querySelectorAll('[data-dg-cell] svg')
        expect(stars.length).toBeGreaterThan(0)
    })
})
