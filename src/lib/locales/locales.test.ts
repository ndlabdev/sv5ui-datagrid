import { describe, expect, it } from 'vitest'
import { defaultAnnouncerStrings } from '../core/interaction/announcer.svelte.js'
import { resolveLocale } from '../core/interaction/locale.js'
import { defaultLabels } from '../core/interaction/labels.js'
import type { DataGridLabels, DataGridLocalePack } from '../core/types/index.js'
import * as locales from './index.js'

const packs = Object.values(locales) as DataGridLocalePack[]

/**
 * Operators shown as maths rather than words: every language keeps them, so a
 * pack matching English here is right, not a hole.
 */
const SYMBOLIC = new Set(['eq', 'neq', 'gt', 'gte', 'lt', 'lte'])

/**
 * Words a language genuinely borrows from English. Matching English here is
 * the correct translation, so they are named rather than left to slip through
 * a blanket exemption.
 */
const LOANWORDS: Record<string, string[]> = {
    'id-ID': ['openFilter']
}

/** Plausible arguments for every label that is a function. */
const ARGS: Record<string, unknown[]> = {
    removeFilter: ['Name'],
    columnMenu: ['Name'],
    resizeColumn: ['Name'],
    resizeGroup: ['Group'],
    filterColumn: ['Name'],
    filterOperator: [1],
    filterValue: [1],
    filterUpperBound: [1],
    selectRow: [3],
    dragRow: [3],
    pageSizeOption: [25],
    pageRange: [1, 25, 300],
    totalRows: [300],
    filteredRows: [12, 300],
    selectedRows: [4]
}

const ANNOUNCER_ARGS: Record<string, unknown[]> = {
    sorted: ['Name', 'asc'],
    sortCleared: [],
    filtered: [12],
    page: [2],
    columnResized: ['Name', 180],
    columnMoved: ['Name', 3],
    columnPinned: ['Name', 'left'],
    columnVisibility: ['Name', true],
    selected: [4],
    copied: [4],
    rowExpanded: [true],
    rowPinned: ['top'],
    rowMoved: [3],
    editInvalid: ['too long']
}

describe('shipped languages', () => {
    it('ships more than a token pair', () => {
        expect(packs.length).toBeGreaterThanOrEqual(12)
    })

    it('gives every pack a tag of its own that resolves back to it', () => {
        const tags = packs.map((locale) => locale.tag)
        expect(new Set(tags).size).toBe(tags.length)

        // Handed the whole set, each tag must still find its own pack — an
        // ordering or matching bug would show up as a neighbour winning.
        for (const locale of packs) {
            expect(resolveLocale(packs, locale.tag)?.tag).toBe(locale.tag)
        }
    })

    it('answers a bare language code with the region it ships', () => {
        for (const locale of packs) {
            const language = locale.tag.split('-')[0]
            expect(resolveLocale([locale], language)?.tag).toBe(locale.tag)
        }
    })

    describe.each(packs.map((locale) => [locale.tag, locale] as const))('%s', (_tag, locale) => {
        it('covers every label key, functions included', () => {
            for (const key of Object.keys(defaultLabels) as (keyof DataGridLabels)[]) {
                const value = locale.labels[key]
                expect(value, `${key} is missing`).toBeDefined()

                if (typeof value === 'function') {
                    const args = ARGS[key]
                    expect(args, `${key} has no test arguments`).toBeDefined()
                    const text = (value as (...a: unknown[]) => string)(...args)
                    expect(typeof text, `${key} did not return a string`).toBe('string')
                    expect(text.trim(), `${key} came back empty`).not.toBe('')
                }
            }
        })

        it('covers every operator the grid can offer', () => {
            for (const map of ['textOps', 'numberOps', 'dateOps'] as const) {
                expect(Object.keys(locale.labels[map]).sort()).toEqual(
                    Object.keys(defaultLabels[map]).sort()
                )
            }
        })

        it('covers every announcer string', () => {
            for (const key of Object.keys(defaultAnnouncerStrings)) {
                const speak = locale.announcer[key as keyof typeof defaultAnnouncerStrings]
                expect(typeof speak, `${key} is missing`).toBe('function')
                const text = (speak as (...a: unknown[]) => string)(...ANNOUNCER_ARGS[key])
                expect(text.trim(), `${key} came back empty`).not.toBe('')
            }
        })

        it.runIf(locale.tag !== 'en-US')(
            'is actually translated, not English copied across',
            () => {
                const borrowed = LOANWORDS[locale.tag] ?? []

                for (const [key, english] of Object.entries(defaultLabels)) {
                    if (typeof english !== 'string' || borrowed.includes(key)) continue
                    expect(
                        locale.labels[key as keyof DataGridLabels],
                        `${key} is still English`
                    ).not.toBe(english)
                }
                for (const map of ['textOps', 'numberOps', 'dateOps'] as const) {
                    for (const [op, english] of Object.entries(defaultLabels[map])) {
                        if (SYMBOLIC.has(op)) continue
                        expect(
                            (locale.labels[map] as Record<string, string>)[op],
                            `${map}.${op} is still English`
                        ).not.toBe(english)
                    }
                }
            }
        )
    })
})
