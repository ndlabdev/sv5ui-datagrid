import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { build } from 'vite'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

const MARKERS: Record<string, string> = {
    formula: 'a date has no arithmetic in this version',
    xlsx: 'schemas.openxmlformats.org/spreadsheetml',
    'import wizard': 'This is not a zip archive',
    'worker row model': 'workerDataSource loaded no value for'
}

async function bundle(source: string): Promise<string> {
    const dir = mkdtempSync(path.join(tmpdir(), 'dg-bundle-'))
    const entry = path.join(dir, 'entry.js')
    writeFileSync(entry, source)

    const output = (await build({
        root: ROOT,
        logLevel: 'error',
        configFile: false,
        plugins: [svelte()],
        resolve: { alias: { $lib: path.join(ROOT, 'src/lib') } },
        build: {
            write: false,
            lib: { entry, formats: ['es'], fileName: 'out' },
            minify: false,
            rollupOptions: { external: ['svelte', 'svelte/internal', 'sv5ui'] }
        }
    })) as { output: { type: string; code?: string }[] }[]

    return output
        .flatMap((chunk) => chunk.output)
        .map((file) => ('code' in file ? (file.code ?? '') : ''))
        .join('\n')
}

describe('what a grid drags in', () => {
    it('leaves out every module the entry did not name', async () => {
        const code = await bundle(
            `import { createDataGrid, sorting } from '$lib/index.js'
             export const grid = createDataGrid({
                 data: [],
                 columns: [],
                 getRowId: (row) => row.id,
                 features: [sorting()]
             })`
        )

        const found = Object.entries(MARKERS)
            .filter(([, marker]) => code.includes(marker))
            .map(([name]) => name)

        expect(found).toEqual([])
    }, 120_000)

    it('brings one in when the entry does name it', async () => {
        const code = await bundle(
            `import { formula } from '$lib/index.js'
             export const feature = formula({})`
        )

        expect(code).toContain(MARKERS.formula)
        expect(code).not.toContain(MARKERS.xlsx)
    }, 120_000)
})
