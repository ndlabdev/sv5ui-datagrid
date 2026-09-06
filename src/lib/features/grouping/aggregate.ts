import { isBlank, numericOrNull } from '../../core/utils/index.js'
import type { Aggregation } from './grouping.types.js'

function numbersOf(values: unknown[]): number[] {
    const numbers: number[] = []
    for (const value of values) {
        const parsed = numericOrNull(value)
        if (parsed !== null) numbers.push(parsed)
    }
    return numbers
}

function distinctKey(value: unknown): unknown {
    return value instanceof Date ? `date:${value.getTime()}` : value
}

function distinctCount(values: unknown[]): number {
    const seen = new Set<unknown>()
    for (const value of values) {
        if (!isBlank(value)) seen.add(distinctKey(value))
    }
    return seen.size
}

function percentileOf(numbers: number[], fraction: number): number {
    const sorted = [...numbers].sort((left, right) => left - right)
    const position = (sorted.length - 1) * Math.min(1, Math.max(0, fraction))
    const lower = Math.floor(position)
    const upper = Math.ceil(position)
    if (lower === upper) return sorted[lower]!
    return sorted[lower]! + (sorted[upper]! - sorted[lower]!) * (position - lower)
}

function weightedAvg<TRow>(
    values: unknown[],
    rows: TRow[],
    weightOf: (row: TRow) => unknown
): number | null {
    let total = 0
    let weights = 0
    const pairs = Math.min(values.length, rows.length)
    for (let index = 0; index < pairs; index += 1) {
        const value = numericOrNull(values[index])
        const weight = numericOrNull(weightOf(rows[index]!))
        if (value === null || weight === null) continue
        total += value * weight
        weights += weight
    }
    return weights === 0 ? null : total / weights
}

function endValue(values: unknown[], end: 'first' | 'last'): unknown {
    const present = values.filter((value) => !isBlank(value))
    if (present.length === 0) return null
    return end === 'first' ? present[0] : present[present.length - 1]
}

function aggregateNumbers(
    kind: 'sum' | 'min' | 'max' | 'avg' | 'median',
    values: unknown[]
): number | null {
    const numbers = numbersOf(values)
    if (numbers.length === 0) return null

    switch (kind) {
        case 'sum':
            return numbers.reduce((total, value) => total + value, 0)
        case 'min':
            return Math.min(...numbers)
        case 'max':
            return Math.max(...numbers)
        case 'avg':
            return numbers.reduce((total, value) => total + value, 0) / numbers.length
        case 'median':
            return percentileOf(numbers, 0.5)
    }
}

export function aggregate<TRow>(
    aggregation: Aggregation<TRow>,
    values: unknown[],
    rows: TRow[]
): unknown {
    if (typeof aggregation === 'function') return aggregation(values, rows)

    if (typeof aggregation === 'object') {
        if (aggregation.kind === 'weightedAvg') return weightedAvg(values, rows, aggregation.weight)
        const numbers = numbersOf(values)
        return numbers.length === 0 ? null : percentileOf(numbers, aggregation.p)
    }

    switch (aggregation) {
        case 'count':
            return rows.length
        case 'distinctCount':
            return distinctCount(values)
        case 'first':
        case 'last':
            return endValue(values, aggregation)
        default:
            return aggregateNumbers(aggregation, values)
    }
}
