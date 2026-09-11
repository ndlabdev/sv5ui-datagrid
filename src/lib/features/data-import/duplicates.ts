import type { ImportProblem, ProblemKind } from './stage.js'

const KEY_SEPARATOR = '\u0000'

const NO_KEYS: ReadonlySet<string> = new Set<string>()

export type DuplicateScope = 'file' | 'grid' | 'both'

export interface DuplicateOptions {
    columns: string[]
    against: DuplicateScope
}

interface DuplicateMessages {
    inFile: (key: string) => string
    inGrid: (key: string) => string
}

function part(value: unknown): string | null {
    if (value === null || value === undefined) return null
    if (value instanceof Date) {
        const time = value.getTime()
        return Number.isNaN(time) ? null : String(time)
    }
    const text = String(value).trim()
    return text === '' ? null : text.toLowerCase()
}

export function duplicateKey(row: unknown, columns: string[]): string | null {
    if (columns.length === 0) return null

    const parts: string[] = []
    for (const columnId of columns) {
        const piece = part((row as Record<string, unknown>)[columnId])
        if (piece === null) return null
        parts.push(piece)
    }
    return parts.join(KEY_SEPARATOR)
}

function keyLabel(row: unknown, columns: string[]): string {
    return columns
        .map((columnId) => String((row as Record<string, unknown>)[columnId] ?? ''))
        .filter((piece) => piece !== '')
        .join(' / ')
}

export function noKeys(): ReadonlySet<string> {
    return NO_KEYS
}

export function existingKeys(rows: readonly unknown[], columns: string[]): Set<string> {
    const keys = new Set<string>()
    for (const row of rows) {
        const key = duplicateKey(row, columns)
        if (key !== null) keys.add(key)
    }
    return keys
}

function kindOf(
    key: string,
    against: DuplicateScope,
    known: ReadonlySet<string>,
    seen: ReadonlySet<string>
): ProblemKind | null {
    if (against !== 'file' && known.has(key)) return 'existing'
    if (against !== 'grid' && seen.has(key)) return 'duplicate'
    return null
}

export function duplicateProblems(
    rows: readonly unknown[],
    options: DuplicateOptions,
    known: ReadonlySet<string>,
    messages: DuplicateMessages
): ImportProblem[] {
    const { columns, against } = options
    const columnId = columns[0]
    if (!columnId) return []

    const seen = new Set<string>()
    const problems: ImportProblem[] = []

    for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
        const key = duplicateKey(rows[rowIndex], columns)
        if (key === null) continue

        const kind = kindOf(key, against, known, seen)
        seen.add(key)
        if (kind === null) continue

        const label = keyLabel(rows[rowIndex], columns)
        problems.push({
            rowIndex,
            columnId,
            kind,
            message: kind === 'existing' ? messages.inGrid(label) : messages.inFile(label)
        })
    }

    return problems
}
