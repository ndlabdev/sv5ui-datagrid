import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

const BANNED: Record<string, string> = {
    '—': 'em dash, write - or restructure the sentence',
    '–': 'en dash, write -',
    '…': 'ellipsis, write ...',
    '·': 'middle dot, write |',
    '×': 'multiplication sign, write x',
    '‘': "curly quote, write '",
    '’': "curly quote, write '",
    '“': 'curly quote, write "',
    '”': 'curly quote, write "'
}

function walk(dir: string, out: string[] = []): string[] {
    for (const entry of readdirSync(dir)) {
        if (entry === 'node_modules' || entry.startsWith('.')) continue
        const full = path.join(dir, entry)
        if (statSync(full).isDirectory()) walk(full, out)
        else if (/\.(ts|js|svelte|css|md)$/.test(entry)) out.push(full)
    }
    return out
}

const files = [
    ...walk(path.join(ROOT, 'src')),
    path.join(ROOT, 'README.md'),
    path.join(ROOT, 'CHANGELOG.md'),
    path.join(ROOT, 'MIGRATING.md')
]

const LANGUAGE_DATA = ['src/lib/locales/', 'src/lib/core/interaction/labels.ts']

const LANGUAGE_MARKS = new Set(['\u2019', '\u2014'])

function isLanguageData(relative: string): boolean {
    return LANGUAGE_DATA.some((prefix) => relative.replaceAll('\\\\', '/').startsWith(prefix))
}

const isComment = (line: string): boolean => /^\s*(\*|\/\/|\/\*)/.test(line)

describe('the text a keyboard can type', () => {
    it('finds the files to check, so a broken walk cannot pass silently', () => {
        expect(files.length).toBeGreaterThan(50)
    })

    it('has no character a person cannot type', () => {
        const found: string[] = []

        for (const file of files) {
            const relative = path.relative(ROOT, file)
            if (relative.endsWith('typography.test.ts')) continue

            const data = isLanguageData(relative)
            const lines = readFileSync(file, 'utf8').split('\n')
            for (const [index, line] of lines.entries()) {
                for (const [character, advice] of Object.entries(BANNED)) {
                    if (!line.includes(character)) continue
                    if (data && !isComment(line) && LANGUAGE_MARKS.has(character)) continue
                    found.push(`${relative}:${index + 1} ${character} (${advice})`)
                }
            }
        }

        expect(found).toEqual([])
    })

    it('leaves a language the punctuation it writes with', () => {
        const chinese = readFileSync(path.join(ROOT, 'src/lib/locales/zh-CN.ts'), 'utf8')

        expect(chinese, 'a full-width colon is how Chinese writes one').toContain('：')
    })
})
