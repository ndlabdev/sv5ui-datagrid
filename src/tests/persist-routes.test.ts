import { existsSync, readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const ROUTES = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../routes')

/**
 * A grid with `persistState` restores from localStorage, which only exists on
 * the client. Server-rendering it paints the default layout and corrects it
 * after hydration — a visible flash on reload. Every demo that persists state
 * must opt out of SSR, so this invariant is enforced rather than remembered.
 */
describe('persisted demo routes disable SSR', () => {
    const offenders: string[] = []

    for (const entry of readdirSync(ROUTES, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue
        const pageSvelte = path.join(ROUTES, entry.name, '+page.svelte')
        if (!existsSync(pageSvelte)) continue
        if (!readFileSync(pageSvelte, 'utf8').includes('persistState')) continue

        const pageTs = path.join(ROUTES, entry.name, '+page.ts')
        const disablesSsr =
            existsSync(pageTs) && /export const ssr\s*=\s*false/.test(readFileSync(pageTs, 'utf8'))
        if (!disablesSsr) offenders.push(entry.name)
    }

    it('sets `export const ssr = false` on every persistState route', () => {
        expect(offenders).toEqual([])
    })
})
