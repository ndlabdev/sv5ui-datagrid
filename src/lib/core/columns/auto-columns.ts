import type { ColumnDef, ColumnType, FilterType } from '../types/index.js'
import { isBlank } from '../utils/value.js'

import type { AutoColumnsOptions } from './auto-columns.types.js'

const INTERNAL_PREFIX = '__'
const DEFAULT_SAMPLE = 50
const SET_FILTER_MAX = 8
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/
const DATE_TIME = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/

export function headerOf(key: string): string {
    const spaced = key
        .replace(/[_-]+/g, ' ')
        .replace(/([a-z\d])([A-Z])/g, '$1 $2')
        .replace(/\s+/g, ' ')
        .trim()
    return spaced.replace(
        /(^|\s)(\w)/g,
        (_, lead: string, first: string) => lead + first.toUpperCase()
    )
}

function keysOf(rows: unknown[]): string[] {
    const keys: string[] = []
    const seen = new Set<string>()
    for (const row of rows) {
        if (row === null || typeof row !== 'object') continue
        for (const key of Object.keys(row)) {
            if (seen.has(key) || key.startsWith(INTERNAL_PREFIX)) continue
            seen.add(key)
            keys.push(key)
        }
    }
    return keys
}

function valuesOf(rows: unknown[], key: string): unknown[] {
    const values: unknown[] = []
    for (const row of rows) {
        const value = (row as Record<string, unknown> | null)?.[key]
        if (!isBlank(value)) values.push(value)
    }
    return values
}

type Shape = { type: ColumnType; filter: FilterType }

function dateShape(values: unknown[]): Shape | null {
    const dates = values.filter((value) => value instanceof Date).length
    const stamps = values.filter(
        (value) => typeof value === 'string' && DATE_TIME.test(value)
    ).length
    const days = values.filter((value) => typeof value === 'string' && DATE_ONLY.test(value)).length

    if (dates + stamps + days < values.length) return null
    return { type: days === values.length ? 'date' : 'datetime', filter: 'date' }
}

function repeatShape(values: unknown[]): Shape {
    const distinct = new Set(values.map(String))
    return distinct.size <= SET_FILTER_MAX && distinct.size * 2 <= values.length
        ? { type: 'badge', filter: 'set' }
        : { type: 'text', filter: 'text' }
}

function guess(values: unknown[]): Shape | null {
    if (values.length === 0) return { type: 'text', filter: 'text' }

    if (values.every((value) => typeof value === 'boolean')) {
        return { type: 'boolean', filter: 'boolean' }
    }
    if (values.every((value) => typeof value === 'number')) {
        return { type: 'number', filter: 'number' }
    }

    const dates = dateShape(values)
    if (dates) return dates

    if (values.some((value) => typeof value === 'object')) return null
    return repeatShape(values)
}

function ordered(keys: string[], order: string[]): string[] {
    const named = [...new Set(order)].filter((key) => keys.includes(key))
    return [...named, ...keys.filter((key) => !named.includes(key))]
}

function defOf<TRow>(
    key: string,
    header: string,
    shape: Shape | null,
    override: Partial<ColumnDef<TRow>> | undefined
): ColumnDef<TRow> {
    const guessed: Partial<ColumnDef<TRow>> = shape
        ? { type: shape.type, filter: shape.filter }
        : {}
    if (shape?.type === 'number') guessed.align = 'right'

    return { id: key, header, sortable: true, ...guessed, ...override }
}

export function autoColumns<TRow>(
    rows: TRow[],
    options: AutoColumnsOptions<TRow> = {}
): ColumnDef<TRow>[] {
    const asked = options.sample ?? DEFAULT_SAMPLE
    const sample = rows.slice(0, Math.max(1, Math.trunc(asked)))
    const exclude = new Set(options.exclude ?? [])
    const header = options.header ?? headerOf
    const overrides = options.overrides ?? {}

    const keys = ordered(
        keysOf(sample).filter((key) => !exclude.has(key)),
        options.order ?? []
    )

    const columns: ColumnDef<TRow>[] = []
    for (const key of keys) {
        const override = overrides[key]
        const shape = guess(valuesOf(sample, key))
        if (shape || override) columns.push(defOf(key, header(key), shape, override))
    }
    return columns
}
