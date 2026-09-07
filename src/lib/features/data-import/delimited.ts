interface DelimitedOptions {
    delimiter?: string
    maxRows?: number
    maxCells?: number
}

const DEFAULT_MAX_ROWS = 200_000
const DEFAULT_MAX_CELLS = 4_000_000

const BOM = '﻿'

export function sniffDelimiter(text: string): string {
    const line = text.slice(0, 64_000).split(/\r?\n/)[0] ?? ''
    const candidates = [',', '\t', ';', '|']

    let best = ','
    let bestCount = 0
    for (const candidate of candidates) {
        let count = 0
        let quoted = false
        for (let index = 0; index < line.length; index++) {
            const char = line[index]
            if (char === '"') quoted = !quoted
            else if (!quoted && char === candidate) count += 1
        }
        if (count > bestCount) {
            best = candidate
            bestCount = count
        }
    }
    return best
}

interface Scanner {
    field: string
    quoted: boolean
    skip: boolean
}

type Step = 'none' | 'field' | 'row'

function insideQuotes(text: string, index: number, scanner: Scanner): void {
    const char = text[index]!
    if (char !== '"') {
        scanner.field += char
        return
    }
    if (text[index + 1] === '"') {
        scanner.field += '"'
        scanner.skip = true
        return
    }
    scanner.quoted = false
}

function outsideQuotes(text: string, index: number, delimiter: string, scanner: Scanner): Step {
    const char = text[index]!

    if (char === '"' && scanner.field === '') {
        scanner.quoted = true
        return 'none'
    }
    if (char === delimiter) return 'field'
    if (char === '\n') return 'row'
    if (char === '\r') {
        if (text[index + 1] === '\n') scanner.skip = true
        return 'row'
    }

    scanner.field += char
    return 'none'
}

function advance(text: string, index: number, delimiter: string, scanner: Scanner): Step {
    if (scanner.skip) {
        scanner.skip = false
        return 'none'
    }
    if (scanner.quoted) {
        insideQuotes(text, index, scanner)
        return 'none'
    }
    return outsideQuotes(text, index, delimiter, scanner)
}

function dropTrailingBlank(rows: string[][]): string[][] {
    while (rows.length > 0 && rows[rows.length - 1]!.every((cell) => cell === '')) rows.pop()
    return rows
}

function makeSink(options: DelimitedOptions) {
    const maxRows = options.maxRows ?? DEFAULT_MAX_ROWS
    const maxCells = options.maxCells ?? DEFAULT_MAX_CELLS
    const rows: string[][] = []
    let row: string[] = []
    let cells = 0

    return {
        rows,
        pending: () => row.length,
        field(text: string) {
            row.push(text)
            cells += 1
            if (cells > maxCells) {
                throw new RangeError(
                    `The file holds more than ${maxCells.toLocaleString('en-US')} cells, which ` +
                        'is more than this reads in one go. Split it, or raise maxCells.'
                )
            }
        },
        endRow(text: string) {
            this.field(text)
            rows.push(row)
            row = []
            if (rows.length > maxRows) {
                throw new RangeError(
                    `The file holds more than ${maxRows.toLocaleString('en-US')} rows, which is ` +
                        'more than this reads in one go. Split it, or raise maxRows.'
                )
            }
        }
    }
}

export function parseDelimited(input: string, options: DelimitedOptions = {}): string[][] {
    const text = input.startsWith(BOM) ? input.slice(1) : input
    const delimiter = options.delimiter ?? sniffDelimiter(text)
    const sink = makeSink(options)
    const scanner: Scanner = { field: '', quoted: false, skip: false }

    for (let index = 0; index < text.length; index++) {
        const step = advance(text, index, delimiter, scanner)
        if (step === 'none') continue

        if (step === 'field') sink.field(scanner.field)
        else sink.endRow(scanner.field)
        scanner.field = ''
    }

    if (scanner.field !== '' || sink.pending() > 0) sink.endRow(scanner.field)
    return dropTrailingBlank(sink.rows)
}

export function looksLikeHeader(rows: string[][]): boolean {
    const first = rows[0]
    if (!first || rows.length < 2) return false

    const filled = first.filter((cell) => cell.trim() !== '')
    if (filled.length === 0) return false

    const numericHeaders = filled.filter((cell) => Number.isFinite(Number(cell.trim()))).length
    if (numericHeaders > filled.length / 2) return false

    const unique = new Set(filled.map((cell) => cell.trim().toLowerCase()))
    return unique.size === filled.length
}
