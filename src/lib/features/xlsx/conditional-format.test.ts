import { describe, expect, it } from 'vitest'
import type { FormatRule } from '../conditional-formatting/index.js'
import {
    conditionalFormatXml,
    DEFAULT_FORMAT_COLORS,
    toArgb,
    xlsxFormatRules,
    type XlsxFormatContext
} from './conditional-format.js'

function context(over: Partial<XlsxFormatContext> = {}): XlsxFormatContext {
    let next = 0
    return {
        letterOf: (columnId) => ({ amount: 'C', email: 'D' })[columnId],
        rowCount: 3,
        colors: DEFAULT_FORMAT_COLORS,
        addDxf: () => next++,
        ...over
    }
}

const xmlOf = (rules: FormatRule[], over: Partial<XlsxFormatContext> = {}) =>
    conditionalFormatXml(xlsxFormatRules(rules, context(over)))

describe('toArgb', () => {
    it('reads the hex shapes a rule may carry', () => {
        expect(toArgb('#3B82F6', '#000000')).toBe('FF3B82F6')
        expect(toArgb('#abc', '#000000')).toBe('FFAABBCC')
        expect(toArgb('80FF0000', '#000000')).toBe('80FF0000')
        expect(toArgb('rgb(59, 130, 246)', '#000000')).toBe('FF3B82F6')
    })

    it('falls back for a colour only a browser can resolve', () => {
        expect(toArgb('var(--color-primary)', '#3B82F6')).toBe('FF3B82F6')
        expect(toArgb('color-mix(in oklab, red 40%, transparent)', '#3B82F6')).toBe('FF3B82F6')
        expect(toArgb(undefined, '#3B82F6')).toBe('FF3B82F6')
    })
})

describe('rules Excel has an equivalent for', () => {
    it('writes a colour scale over the column, letting Excel compute the ramp', () => {
        const xml = xmlOf([{ kind: 'colorScale', column: 'amount', from: '#fff', to: '#0a7' }])

        expect(xml).toContain('sqref="C2:C4"')
        expect(xml).toContain('type="colorScale"')
        expect(xml).toContain('<cfvo type="min"/><cfvo type="max"/>')
        expect(xml).toContain('<color rgb="FFFFFFFF"/><color rgb="FF00AA77"/>')
    })

    it('adds the middle stop only when the rule has one', () => {
        const xml = xmlOf([
            { kind: 'colorScale', column: 'amount', from: '#f00', via: '#fff', to: '#0f0' }
        ])
        expect(xml).toContain('<cfvo type="percentile" val="50"/>')
    })

    it('pins the ends when the rule pinned them', () => {
        const xml = xmlOf([{ kind: 'colorScale', column: 'amount', min: 0, max: 100 }])
        expect(xml).toContain('<cfvo type="num" val="0"/><cfvo type="num" val="100"/>')
    })

    it('writes a data bar Excel draws itself', () => {
        const xml = xmlOf([{ kind: 'dataBar', column: 'amount', color: '#638EC6' }])
        expect(xml).toContain('type="dataBar"')
        expect(xml).toContain('<color rgb="FF638EC6"/>')
    })

    it('maps duplicates and uniques onto the two rule types Excel has', () => {
        expect(xmlOf([{ kind: 'duplicates', column: 'email' }])).toContain('type="duplicateValues"')
        expect(xmlOf([{ kind: 'duplicates', column: 'email', unique: true }])).toContain(
            'type="uniqueValues"'
        )
    })

    it('carries the rank and the direction of a topN rule', () => {
        expect(xmlOf([{ kind: 'topN', column: 'amount', n: 5 }])).toContain('rank="5"')
        expect(xmlOf([{ kind: 'topN', column: 'amount', bottom: true }])).toContain('bottom="1"')
    })
})

describe('what the file cannot carry', () => {
    it('leaves an expression rule out, Excel having no equivalent to translate to', () => {
        expect(xmlOf([{ kind: 'expression', column: 'amount', when: 'amount > 1' }])).toBe('')
    })

    it('leaves out a rule naming a column the export does not include', () => {
        expect(xmlOf([{ kind: 'dataBar', column: 'hidden' }])).toBe('')
    })

    it('writes nothing for an empty sheet', () => {
        expect(xmlOf([{ kind: 'dataBar', column: 'amount' }], { rowCount: 0 })).toBe('')
    })
})

describe('priority: on screen the later rule wins, in Excel the lower number does', () => {
    it('gives the last rule the number Excel resolves first', () => {
        const xml = xmlOf([
            { kind: 'dataBar', column: 'amount' },
            { kind: 'colorScale', column: 'amount' }
        ])
        const priorities = [...xml.matchAll(/priority="(\d+)"/g)].map((match) => match[1])

        expect(priorities).toEqual(['2', '1'])
    })
})
