import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, normalize } from 'node:path'
import { describe, expect, it } from 'vitest'

const LIB = join('src', 'lib')
const ROOTS = [
    join('src', 'lib', 'index.ts'),
    join('src', 'lib', 'xlsx.ts'),
    join('src', 'lib', 'locales', 'index.ts')
]

const STATEMENT = /export\s+(type\s+)?(?:\{([^}]*)\}|(\*))\s*from\s*'([^']+)'/g

interface Statement {
    isType: boolean
    body: string | undefined
    isStar: boolean
    specifier: string
}

function walk(dir: string): string[] {
    return readdirSync(dir).flatMap((entry) => {
        const path = join(dir, entry)
        if (statSync(path).isDirectory()) return walk(path)
        return path.endsWith('.ts') || path.endsWith('.svelte') ? [path] : []
    })
}

const SOURCES = walk('src')
const BARRELS = SOURCES.filter(
    (path) => path.startsWith(LIB) && (path.endsWith(join('', 'index.ts')) || ROOTS.includes(path))
)

function statementsOf(source: string): Statement[] {
    return [...source.matchAll(STATEMENT)].map((match) => ({
        isType: match[1] !== undefined,
        body: match[2],
        isStar: match[3] !== undefined,
        specifier: match[4]!
    }))
}

function namesOf(statement: Statement): { values: string[]; types: string[] } {
    const values: string[] = []
    const types: string[] = []
    for (const raw of (statement.body ?? '').split(',')) {
        const spec = raw.trim()
        if (!spec) continue
        if (statement.isType || spec.startsWith('type ')) types.push(spec.replace(/^type\s+/, ''))
        else values.push(spec)
    }
    return { values, types }
}

function byName(a: string, b: string): number {
    return a.toLowerCase().localeCompare(b.toLowerCase())
}

function sorted(names: string[]): boolean {
    return names.join() === [...names].sort(byName).join()
}

function sortedModules(specifiers: string[]): boolean {
    const rank = (specifier: string) => (specifier.startsWith('.') ? 1 : 0)
    const wanted = [...specifiers].sort((a, b) => rank(a) - rank(b) || byName(a, b))
    return specifiers.join() === wanted.join()
}

function resolve(from: string, specifier: string): string | null {
    if (!specifier.startsWith('.')) return null
    const base = normalize(join(dirname(from), specifier)).replace(/\.js$/, '.ts')
    for (const candidate of [base, `${base}.ts`, join(base, 'index.ts')]) {
        if (SOURCES.includes(candidate)) return candidate
    }
    return null
}

function taken(): Map<string, Set<string>> {
    const map = new Map<string, Set<string>>()
    const importing = /(?:import|export)\s+(?:type\s+)?\{([^}]*)\}\s*from\s*'([^']+)'/g
    for (const path of SOURCES) {
        for (const match of readFileSync(path, 'utf8').matchAll(importing)) {
            const target = resolve(path, match[2]!)
            if (target === null || target === path) continue
            const names = map.get(target) ?? new Set<string>()
            for (const raw of match[1]!.split(',')) {
                const name = raw
                    .trim()
                    .replace(/^type\s+/, '')
                    .split(' as ')[0]
                    ?.trim()
                if (name) names.add(name)
            }
            map.set(target, names)
        }
    }
    return map
}

function publicSurface(): Set<string> {
    const reached = new Set<string>()
    const star = /export\s+(?:type\s+)?\*\s*from\s*'([^']+)'/g
    const visit = (path: string) => {
        if (reached.has(path) || !SOURCES.includes(path)) return
        reached.add(path)
        for (const match of readFileSync(path, 'utf8').matchAll(star)) {
            const target = resolve(path, match[1]!)
            if (target !== null) visit(target)
        }
    }
    for (const root of ROOTS) visit(root)
    return reached
}

const PUBLIC = publicSurface()
const TAKEN = taken()

describe('every barrel has the same shape', () => {
    it('finds the barrels, so a broken walk cannot pass silently', () => {
        expect(BARRELS.length).toBeGreaterThan(30)
    })

    it('re-exports and nothing else', () => {
        const impure = BARRELS.filter(
            (path) => readFileSync(path, 'utf8').replace(STATEMENT, '').trim() !== ''
        )
        expect(impure).toEqual([])
    })

    it('names each source module once', () => {
        const doubled = BARRELS.filter((path) => {
            const keys = statementsOf(readFileSync(path, 'utf8'))
                .filter((statement) => !statement.isStar)
                .map((statement) => statement.specifier)
            return new Set(keys).size !== keys.length
        })
        expect(doubled).toEqual([])
    })

    it('orders statements by module and specifiers by name', () => {
        const unsorted: string[] = []
        for (const path of BARRELS) {
            const statements = statementsOf(readFileSync(path, 'utf8'))
            if (!sortedModules(statements.map((statement) => statement.specifier))) {
                unsorted.push(`${path} (modules)`)
            }
            for (const statement of statements) {
                const { values, types } = namesOf(statement)
                if (!sorted(values) || !sorted(types)) {
                    unsorted.push(`${path} -> ${statement.specifier}`)
                }
            }
        }
        expect(unsorted).toEqual([])
    })

    it('offers no name the library never imports', () => {
        const unused: string[] = []
        for (const path of BARRELS) {
            if (PUBLIC.has(path)) continue
            const users = TAKEN.get(path) ?? new Set<string>()
            for (const statement of statementsOf(readFileSync(path, 'utf8'))) {
                const { values, types } = namesOf(statement)
                for (const spec of [...values, ...types]) {
                    const offered = spec.split(' as ').pop()!.trim()
                    if (!users.has(offered)) unused.push(`${path}: ${offered}`)
                }
            }
        }
        expect(unused).toEqual([])
    })
})
