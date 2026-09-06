import type { CellRange } from './range.js'

type Series = (index: number) => unknown

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const TRAILING_NUMBER = /^(.*?)(\d+)$/

function constantStep(values: number[]): number | null {
    if (values.length < 2) return null
    const step = values[1]! - values[0]!
    for (let i = 2; i < values.length; i++) {
        if (values[i]! - values[i - 1]! !== step) return null
    }
    return step
}

function asNumbers(source: unknown[]): number[] | null {
    const numbers: number[] = []
    for (const value of source) {
        if (typeof value !== 'number' || !Number.isFinite(value)) return null
        numbers.push(value)
    }
    return numbers
}

function numericSeries(source: unknown[]): Series | null {
    const numbers = asNumbers(source)
    if (!numbers) return null

    const step = constantStep(numbers)

    if (step === null) return null

    const last = numbers.at(-1)!
    return (index) => last + step * (index + 1)
}

function asDates(source: unknown[]): Date[] | null {
    const dates: Date[] = []
    for (const value of source) {
        const date =
            value instanceof Date
                ? value
                : typeof value === 'string' && ISO_DATE.test(value)
                  ? new Date(`${value}T00:00:00`)
                  : null
        if (!date || Number.isNaN(date.getTime())) return null
        dates.push(date)
    }
    return dates
}

const DAY_MS = 86_400_000

function toIsoDate(date: Date): string {
    const pad = (value: number, width = 2) => String(value).padStart(width, '0')
    return `${pad(date.getFullYear(), 4)}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function dateSeries(source: unknown[]): Series | null {
    const dates = asDates(source)
    if (!dates) return null

    const last = dates.at(-1)!
    const wasIso = typeof source.at(-1) === 'string'
    const shape = (date: Date) => (wasIso ? toIsoDate(date) : date)

    const sameDayOfMonth = dates.every((date) => date.getDate() === dates[0]!.getDate())
    const monthStep = constantStep(dates.map((date) => date.getFullYear() * 12 + date.getMonth()))
    if (sameDayOfMonth && monthStep !== null && monthStep !== 0) {
        return (index) => {
            const next = new Date(last)
            next.setMonth(next.getMonth() + monthStep * (index + 1))
            return shape(next)
        }
    }

    const dayStep = constantStep(dates.map((date) => date.getTime()))
    if (dayStep === null || dayStep % DAY_MS !== 0) return null
    return (index) => shape(new Date(last.getTime() + dayStep * (index + 1)))
}

function textNumberSeries(source: unknown[]): Series | null {
    const parts: { prefix: string; digits: string; value: number }[] = []
    for (const value of source) {
        if (typeof value !== 'string') return null
        const match = TRAILING_NUMBER.exec(value)
        if (!match) return null
        parts.push({ prefix: match[1]!, digits: match[2]!, value: Number(match[2]) })
    }

    const prefix = parts[0]!.prefix
    if (!parts.every((part) => part.prefix === prefix)) return null

    const step = constantStep(parts.map((part) => part.value))
    if (step === null) return null

    const last = parts.at(-1)!

    const width = parts.every((part) => part.digits.length === last.digits.length)
        ? last.digits.length
        : 0
    return (index) => {
        const next = last.value + step * (index + 1)
        return `${prefix}${String(Math.max(0, next)).padStart(width, '0')}`
    }
}

function repeatSeries(source: unknown[]): Series {
    return (index) => source[index % source.length]
}

export function continueSeries(source: unknown[], count: number): unknown[] {
    if (count <= 0) return []
    if (source.length === 0) return []

    const series =
        numericSeries(source) ??
        dateSeries(source) ??
        textNumberSeries(source) ??
        repeatSeries(source)

    return Array.from({ length: count }, (_, index) => series(index))
}

export type FillAxis = 'down' | 'up' | 'right' | 'left'

export interface FillTarget {
    axis: FillAxis

    range: CellRange
}

export function fillTargetOf(source: CellRange, row: number, col: number): FillTarget | null {
    const below = row - source.bottom
    const above = source.top - row
    const right = col - source.right
    const left = source.left - col

    const vertical = Math.max(below, above)
    const horizontal = Math.max(right, left)
    if (vertical <= 0 && horizontal <= 0) return null

    if (vertical >= horizontal) {
        return below >= above
            ? { axis: 'down', range: { ...source, top: source.bottom + 1, bottom: row } }
            : { axis: 'up', range: { ...source, top: row, bottom: source.top - 1 } }
    }
    return right >= left
        ? { axis: 'right', range: { ...source, left: source.right + 1, right: col } }
        : { axis: 'left', range: { ...source, left: col, right: source.left - 1 } }
}

function span(from: number, to: number, reversed: boolean): number[] {
    const values: number[] = []
    for (let value = from; value <= to; value++) values.push(value)
    return reversed ? values.reverse() : values
}

export interface FillCellsOptions {
    read: (row: number, col: number) => unknown

    isDataRow?: (row: number) => boolean
}

export function fillCells(
    source: CellRange,
    target: FillTarget,
    options: FillCellsOptions
): { row: number; col: number; value: unknown }[] {
    const { read, isDataRow = () => true } = options

    const reversed = target.axis === 'up' || target.axis === 'left'
    const cells: { row: number; col: number; value: unknown }[] = []

    if (target.axis === 'down' || target.axis === 'up') {
        const sourceRows = span(source.top, source.bottom, reversed).filter(isDataRow)
        const targetRows = span(target.range.top, target.range.bottom, reversed).filter(isDataRow)

        for (const col of span(source.left, source.right, false)) {
            const continued = continueSeries(
                sourceRows.map((row) => read(row, col)),
                targetRows.length
            )
            targetRows.forEach((row, index) => {
                cells.push({ row, col, value: continued[index] })
            })
        }
        return cells
    }

    const sourceCols = span(source.left, source.right, reversed)
    const targetCols = span(target.range.left, target.range.right, reversed)

    for (const row of span(source.top, source.bottom, false).filter(isDataRow)) {
        const continued = continueSeries(
            sourceCols.map((col) => read(row, col)),
            targetCols.length
        )
        targetCols.forEach((col, index) => {
            cells.push({ row, col, value: continued[index] })
        })
    }
    return cells
}
