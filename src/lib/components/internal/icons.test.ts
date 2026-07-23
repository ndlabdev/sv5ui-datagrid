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

describe('bundled icons', () => {
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
