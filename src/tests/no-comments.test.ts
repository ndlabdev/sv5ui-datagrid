import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = 'src'
const SUFFIXES = ['.ts', '.svelte']
const SELF = join('src', 'tests', 'no-comments.test.ts')
// Where a comment is the documentation a reader sees on hover: a `.types.ts`
// beside its feature, and the kernel's own type folder, which is the same
// thing spelled with a directory instead of a suffix.
const DOCUMENTED = '.types.ts'
const JSDOC_ON_EXPORT = /\/\*\*(?:[^*]|\*(?!\/))*\*\/\s*\n\s*export\s/
const DOCUMENTED_DIR = join('src', 'lib', 'core', 'types')
const GENERATED = '.data.ts'

const SUPPRESSION = new RegExp(
    ['eslint', 'disable'].join('-') +
        '|' +
        ['svelte', 'ignore'].join('-') +
        '|@ts-' +
        ['ignore', 'expect-error'].join('|@ts-') +
        '|' +
        ['prettier', 'ignore'].join('-')
)

const BEFORE_REGEX = /(^|[(,=:[!&|?{};+\-*%~^<>]|\b(return|typeof|case|in|of|new|void|do|else))\s*$/

function walk(dir: string): string[] {
    return readdirSync(dir).flatMap((entry) => {
        const path = join(dir, entry)
        if (statSync(path).isDirectory()) return walk(path)
        return SUFFIXES.some((suffix) => path.endsWith(suffix)) ? [path] : []
    })
}

function skipQuoted(source: string, start: number): number {
    const quote = source[start]!
    let i = start + 1
    while (i < source.length) {
        if (source[i] === '\\') i += 2
        else if (source[i] === quote) return i + 1
        else i += 1
    }
    return i
}

function skipRegex(source: string, start: number): number {
    let i = start + 1
    let inClass = false
    while (i < source.length) {
        const char = source[i]
        if (char === '\\') {
            i += 2
            continue
        }
        if (char === '[') inClass = true
        else if (char === ']') inClass = false
        else if (char === '/' && !inClass) return i + 1
        else if (char === '\n') return i
        i += 1
    }
    return i
}

/* eslint-disable-next-line complexity -- a tokenizer is a state machine */
function commentsIn(file: string): string[] {
    const source = readFileSync(file, 'utf8')
    const svelte = file.endsWith('.svelte')
    const found: string[] = []
    const lineAt = (index: number) => source.slice(0, index).split('\n').length

    let i = 0
    let inScript = !svelte
    while (i < source.length) {
        if (svelte) {
            if (source.startsWith('<script', i)) inScript = true
            else if (source.startsWith('</script>', i)) inScript = false

            if (!inScript && source.startsWith('<!--', i)) {
                if (!SUPPRESSION.test(source.slice(i, i + 60))) {
                    found.push(`${file}:${lineAt(i)} ${source.slice(i, i + 40).trim()}`)
                }
                const end = source.indexOf('-->', i)
                i = end === -1 ? source.length : end + 3
                continue
            }
        }

        if (!inScript) {
            i += 1
            continue
        }

        const char = source[i]!
        if (char === "'" || char === '"' || char === '`') {
            i = skipQuoted(source, i)
            continue
        }

        if (char === '/') {
            const next = source[i + 1]
            if (next === '/' || next === '*') {
                const end = next === '*' ? source.indexOf('*/', i + 2) : source.indexOf('\n', i)
                const stop = end === -1 ? source.length : end + 2
                if (
                    !SUPPRESSION.test(source.slice(i, i + 60)) &&
                    !JSDOC_ON_EXPORT.test(source.slice(i, stop + 120))
                ) {
                    found.push(`${file}:${lineAt(i)} ${source.slice(i, i + 40).trim()}`)
                }
                i = end === -1 ? source.length : end + (next === '*' ? 2 : 0)
                continue
            }
            if (BEFORE_REGEX.test(source.slice(Math.max(0, i - 60), i))) {
                i = skipRegex(source, i)
                continue
            }
        }

        i += 1
    }
    return found
}

describe('src carries no comment a reader has to be told to ignore', () => {
    const files = walk(ROOT)

    it('finds source to check, so a broken walk cannot pass silently', () => {
        expect(files.length).toBeGreaterThan(40)
    })

    it('has none outside the option types', () => {
        const checked = files.filter(
            (file) =>
                file !== SELF &&
                !file.endsWith(DOCUMENTED) &&
                !file.endsWith(GENERATED) &&
                !file.startsWith(DOCUMENTED_DIR)
        )
        expect(checked.flatMap(commentsIn)).toEqual([])
    })

    it('leaves the generated files their do-not-edit header', () => {
        const generated = files.filter((file) => file.endsWith(GENERATED))
        expect(generated.length).toBeGreaterThan(0)
        expect(generated.filter((file) => commentsIn(file).length === 0)).toEqual([])
    })

    it('still documents every option type, which is where the tooltips come from', () => {
        const documented = files.filter((file) => file.endsWith(DOCUMENTED))
        expect(documented.length).toBeGreaterThan(5)
        expect(documented.filter((file) => commentsIn(file).length === 0)).toEqual([])
    })
})
