import { describe, expect, it } from 'vitest'
import { BUILT_IN_STYLES, StyleTable } from './styles.js'

function counts(xml: string) {
    const read = (tag: string) => Number(new RegExp(`<${tag} count="(\\d+)"`).exec(xml)?.[1] ?? 0)
    return {
        fonts: read('fonts'),
        fills: read('fills'),
        borders: read('borders'),
        cells: read('cellXfs'),
        formats: read('numFmts')
    }
}

describe('StyleTable', () => {
    it('starts with the one style every unstyled cell points at', () => {
        const table = new StyleTable()
        expect(table.size).toBe(1)
        expect(table.add({})).toBe(0)
    })

    it('hands the same id back for the same look', () => {
        const table = new StyleTable()
        const first = table.add({ font: { bold: true }, fill: 'DDEEFF' })
        const second = table.add({ fill: 'DDEEFF', font: { bold: true } })

        expect(second).toBe(first)
        expect(table.size).toBe(2)
    })

    it('shares one font across the cells that use it', () => {
        const table = new StyleTable()
        table.add({ font: { bold: true }, fill: 'FF0000' })
        table.add({ font: { bold: true }, fill: '00FF00' })

        const found = counts(table.toXml())
        expect(found.cells).toBe(3)
        expect(found.fonts).toBe(2)
        expect(found.fills).toBe(4)
    })

    it('pads a six-digit colour to the ARGB Excel wants, and takes a leading hash', () => {
        const table = new StyleTable()
        table.add({ font: { color: '#1A2B3C' } })
        expect(table.toXml()).toContain('<color rgb="FF1A2B3C"/>')
    })

    it('keeps an eight-digit colour as given, alpha and all', () => {
        const table = new StyleTable()
        table.add({ fill: '80FF0000' })
        expect(table.toXml()).toContain('rgb="80FF0000"')
    })

    it('uses the id Excel already has for a format', () => {
        const table = new StyleTable()
        table.add({ numberFormat: '#,##0.00' })

        const xml = table.toXml()
        expect(xml).toContain('numFmtId="4"')
        expect(counts(xml).formats).toBe(0)
    })

    it('declares a custom format once, from 164 up', () => {
        const table = new StyleTable()
        table.add({ numberFormat: '[$$-409]#,##0' })
        table.add({ numberFormat: '0.000' })
        table.add({ numberFormat: '[$$-409]#,##0' })

        const xml = table.toXml()
        expect(counts(xml).formats).toBe(2)
        expect(xml).toContain('numFmtId="164" formatCode="[$$-409]#,##0"')
        expect(xml).toContain('numFmtId="165" formatCode="0.000"')
    })

    it('escapes a format code that would break the XML', () => {
        const table = new StyleTable()
        table.add({ numberFormat: '"<a & b>"#,##0' })
        expect(table.toXml()).toContain('&lt;a &amp; b&gt;')
    })

    it('writes alignment inside the record rather than as an attribute', () => {
        const table = new StyleTable()
        table.add({ alignment: { horizontal: 'center', vertical: 'middle', wrap: true } })

        const xml = table.toXml()
        expect(xml).toContain('applyAlignment="1"')
        expect(xml).toContain('<alignment horizontal="center" vertical="center" wrapText="1"/>')
    })

    it('writes middle as center, which is what the format calls it', () => {
        const table = new StyleTable()
        table.add({ alignment: { vertical: 'middle' } })
        expect(table.toXml()).toContain('vertical="center"')
    })

    it('leaves a side Excel should not draw empty rather than styling it', () => {
        const table = new StyleTable()
        table.add({ border: { bottom: { style: 'medium', color: '000000' } } })

        const xml = table.toXml()
        expect(xml).toContain('<left/><right/><top/>')
        expect(xml).toContain('<bottom style="medium"><color rgb="FF000000"/></bottom>')
    })

    it('keeps the table small when a whole column shares a look', () => {
        const table = new StyleTable()
        for (let row = 0; row < 10_000; row++) table.add(BUILT_IN_STYLES.currency)
        expect(table.size).toBe(2)
    })

    it('writes a document whose counts match what it holds', () => {
        const table = new StyleTable()
        table.add(BUILT_IN_STYLES.header)
        table.add({ fill: 'FFFF00', border: { top: {} } })

        const xml = table.toXml()
        const found = counts(xml)
        expect(found.cells).toBe(table.size)
        expect(xml.split('<font>').length - 1).toBe(found.fonts)
        expect(xml.split('<border>').length - 1).toBe(found.borders)
        expect(xml).toMatch(
            /^<\?xml version="1\.0" encoding="UTF-8" standalone="yes"\?><styleSheet/
        )
        expect(xml.endsWith('</styleSheet>')).toBe(true)
    })
})
