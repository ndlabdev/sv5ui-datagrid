import { describe, expect, it } from 'vitest'
import { defaultAnnouncerStrings } from '../core/interaction/announcer.svelte.js'
import { createDataGrid } from '../core/grid/index.js'
import { resolveLocale } from '../core/interaction/locale.js'
import { defaultLabels } from '../core/interaction/labels.js'
import type {
    DataGridAnnouncerStrings,
    DataGridLabels,
    DataGridLocalePack
} from '../core/types/index.js'
import * as locales from './index.js'

const packs = Object.values(locales) as DataGridLocalePack[]

function announcerOf(pack: DataGridLocalePack): DataGridAnnouncerStrings {
    for (const key of Object.keys(defaultAnnouncerStrings)) {
        expect(
            pack.announcer[key as keyof DataGridAnnouncerStrings],
            `${pack.tag}: ${key}`
        ).toBeDefined()
    }
    return pack.announcer as DataGridAnnouncerStrings
}

const SYMBOLIC = new Set(['eq', 'neq', 'gt', 'gte', 'lt', 'lte'])

const LOANWORDS: Record<string, string[]> = {
    'de-DE': ['rangeMin', 'rangeMax', 'filterTitle', 'filterBuilderOperator'],
    'fr-FR': ['rangeMin', 'rangeMax', 'formatKindExpression'],
    'id-ID': ['openFilter', 'rangeMin', 'filterTitle', 'filterBuilderOperator']
}

const ARGS: Record<string, unknown[]> = {
    removeFilter: ['Name'],
    columnMenu: ['Name'],
    resizeColumn: ['Name'],
    resizeGroup: ['Group'],
    filterColumn: ['Name'],
    collapseGroup: ['Pay'],
    expandGroup: ['Pay'],
    filterOperator: [1],
    filterValue: [1],
    filterRowValue: ['Name'],
    filterUpperBound: [1],
    selectRow: [3],
    dragRow: [3],
    pageSizeOption: [25],
    pageRange: [1, 25, 300],
    totalRows: [300],
    filteredRows: [12, 300],
    selectedRows: [4],

    moveGroupEarlier: ['Region'],
    moveGroupLater: ['Region'],
    removeGroup: ['Region'],
    groupFooter: ['North', 12],
    grandTotal: [300],
    groupLoaded: ['North', 12],
    groupFooterLoaded: ['North', 12],
    grandTotalLoaded: [300],

    rangeCells: ['12'],
    rangeShape: [3, 4],

    commandShowColumn: ['Name'],
    commandHideColumn: ['Name'],
    commandUnpinColumn: ['Name'],
    commandPinColumnLeft: ['Name'],
    commandPinColumnRight: ['Name'],
    commandGroupByColumn: ['Region'],
    commandUngroupColumn: ['Region'],

    findCount: [2, 9],
    findNoWritable: [9],
    findReplaced: [4],
    findCountLoaded: [2, 9],

    viewShareTooLong: [2400],

    formatRuleName: ['Colour scale', 'Pay'],
    formatRemoveRule: ['Colour scale: Pay'],
    formatBadExpression: ['unexpected )'],

    toolPanelMoveUp: ['Name'],
    toolPanelMoveDown: ['Name'],
    toolPanelActions: ['Name'],

    filterJoin: ['and'],
    filterOp: ['contains'],

    importUnknownFormat: ['notes.rtf'],
    importAddRows: [120],
    importAddValid: [118],
    importIssues: [2],
    importNotNumber: ['Pay'],
    importNotDate: ['Hired'],
    importNotBoolean: ['Active'],
    importInvalid: ['Email'],
    importDuplicate: ['ada@example.com'],
    importExisting: ['ada@example.com'],
    importRowCount: [120],
    importTooBig: ['people.xlsx', 8],
    importMatched: [5, 7]
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
    groupCollapsed: ['Pay', true],
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
                expect(Object.keys(locale.labels[map] ?? {}).sort()).toEqual(
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

const INFLECTS_FOR_COUNT = ['en-US', 'de-DE', 'es-ES', 'fr-FR', 'pt-BR', 'ru-RU']

describe('counted announcements', () => {
    const counting = ['filtered', 'selected', 'copied'] as const

    for (const locale of packs) {
        const inflects = INFLECTS_FOR_COUNT.includes(locale.tag)

        it.runIf(inflects)(`${locale.tag} says one row differently from many`, () => {
            const announcer = announcerOf(locale)
            for (const key of counting) {
                const speak = announcer[key]
                expect(speak(1), `${locale.tag} ${key}`).not.toBe(
                    speak(4).replace(/(?<![\d])4(?![\d])/, '1')
                )
            }
        })

        it.runIf(!inflects)(`${locale.tag} has no number to mark, so it does not`, () => {
            const announcer = announcerOf(locale)
            for (const key of counting) {
                const speak = announcer[key]
                expect(speak(1).replace(/(?<![\d])1(?![\d])/, '4'), `${locale.tag} ${key}`).toBe(
                    speak(4)
                )
            }
        })
    }

    it('follows the language rather than a count of one', () => {
        const fr = packs.find((pack) => pack.tag === 'fr-FR')!
        const en = packs.find((pack) => pack.tag === 'en-US')!

        expect(announcerOf(fr).selected(0)).toContain('ligne sélectionnée')
        expect(announcerOf(en).selected(0)).toContain('rows')
    })

    it('uses the three forms Russian needs, not two', () => {
        const ru = packs.find((pack) => pack.tag === 'ru-RU')!
        const speak = announcerOf(ru).selected
        expect(speak(1)).toMatch(/строка$/)
        expect(speak(3)).toMatch(/строки$/)
        expect(speak(9)).toMatch(/строк$/)
    })
})

describe('a pack that says less than the grid asks', () => {
    it('lets English answer for what it does not carry', () => {
        const grid = createDataGrid<{ id: string }>({
            columns: [{ id: 'id' }],
            data: [],
            getRowId: (row) => row.id,
            locale: 'sv-SE',
            locales: [{ tag: 'sv-SE', labels: { search: 'Sök...' }, announcer: {} }]
        })

        expect(grid.labels.search).toBe('Sök...')
        expect(grid.labels.exportAllRows).toBe(defaultLabels.exportAllRows)
        expect(grid.labels.textOps.contains).toBe(defaultLabels.textOps.contains)
        expect(grid.announcerStrings.sortCleared()).toBe(defaultAnnouncerStrings.sortCleared())
    })

    it('is still overridden by what the app says itself', () => {
        const grid = createDataGrid<{ id: string }>({
            columns: [{ id: 'id' }],
            data: [],
            getRowId: (row) => row.id,
            locale: 'sv-SE',
            locales: [{ tag: 'sv-SE', labels: { search: 'Sök...' }, announcer: {} }],
            labels: { search: 'Hitta' }
        })
        expect(grid.labels.search).toBe('Hitta')
    })
})
