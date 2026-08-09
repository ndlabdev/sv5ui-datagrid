import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { datagridIcons } from './icons.data.js'

const LIB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

function walk(dir: string, out: string[] = []): string[] {
    for (const entry of readdirSync(dir)) {
        const full = path.join(dir, entry)
        if (statSync(full).isDirectory()) walk(full, out)
        else if (/\.(svelte|ts)$/.test(entry) && !/\.(test|spec)\./.test(entry)) out.push(full)
    }
    return out
}

function usedIcons(): Set<string> {
    const names = new Set<string>()
    for (const file of walk(LIB)) {
        for (const match of readFileSync(file, 'utf8').matchAll(/lucide:([a-z0-9-]+)/g)) {
            names.add(match[1])
        }
    }
    return names
}

const SV5UI = path.resolve(LIB, '../../node_modules/sv5ui/dist')

/** What sv5ui components reach for when nothing overrides them. */
function sv5uiDefaults(): string[] {
    const config = readFileSync(path.join(SV5UI, 'config.js'), 'utf8')
    const block = config.match(/export const iconsDefaults = \{([\s\S]*?)\n\}/)
    if (!block) throw new Error('sv5ui no longer exports iconsDefaults the same way')
    return [...block[1].matchAll(/'([a-z0-9-]+:[a-z0-9-]+)'/g)].map((match) => match[1])
}

/** What sv5ui registers for itself, from `Icon.svelte`'s module script. */
function sv5uiBundled(): Set<string> {
    const bundled = readFileSync(path.join(SV5UI, 'components/Icon/bundled.js'), 'utf8')
    const prefix = bundled.match(/prefix:\s*'([a-z0-9-]+)'/)?.[1] ?? 'lucide'
    return new Set(
        [...bundled.matchAll(/^\s+'?([a-z0-9-]+)'?:\s*\{/gm)].map(
            (match) => `${prefix}:${match[1]}`
        )
    )
}

describe('bundled icons', () => {
    it('leaves no sv5ui default for the network to answer', () => {
        // Either bundle may hold it — sv5ui registers its own from `Icon.svelte`
        // before the grid renders, so duplicating those would only add bytes.
        // What matters is that nothing falls through both.
        const ours = new Set(Object.keys(datagridIcons.icons).map((name) => `lucide:${name}`))
        const theirs = sv5uiBundled()
        expect(theirs.size).toBeGreaterThan(0)

        const defaults = sv5uiDefaults()
        expect(defaults.length).toBeGreaterThan(0)

        const orphaned = defaults.filter((icon) => !ours.has(icon) && !theirs.has(icon)).sort()
        expect(orphaned).toEqual([])
    })

    it('ships nothing dead', () => {
        // An icon earns its place by being named in our own source, or by
        // being an sv5ui fallback sv5ui does not bundle. The hand-written list
        // this replaced failed both ways at once: it shipped `loader-2`, which
        // nothing renders, while sv5ui asks for `loader-circle`.
        const used = usedIcons()
        const theirs = sv5uiBundled()
        const needed = new Set(used)
        for (const icon of sv5uiDefaults()) {
            if (!theirs.has(icon)) needed.add(icon.split(':')[1])
        }

        const dead = Object.keys(datagridIcons.icons)
            .filter((name) => !needed.has(name))
            .sort()
        expect(dead).toEqual([])
    })

    it('includes every lucide icon the grid source references', () => {
        const bundled = new Set(Object.keys(datagridIcons.icons))
        const missing = [...usedIcons()].filter((name) => !bundled.has(name)).sort()
        // A miss means a new `lucide:*` was added without `npm run generate:icons`,
        // so that icon would fetch from the network at runtime.
        expect(missing).toEqual([])
    })

    it('is a lucide collection with real icon bodies', () => {
        expect(datagridIcons.prefix).toBe('lucide')
        expect(Object.keys(datagridIcons.icons).length).toBeGreaterThan(0)
        for (const [name, icon] of Object.entries(datagridIcons.icons)) {
            expect(icon.body, name).toMatch(/<(path|circle|rect|line|polyline|g)/)
        }
    })
})
