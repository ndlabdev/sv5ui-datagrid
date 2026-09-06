import { escapeXml } from './sheet.js'
import type {
    XlsxAlignment,
    XlsxBorder,
    XlsxBorderSide,
    XlsxColor,
    XlsxFont,
    XlsxStyle
} from './styles.types.js'

const BUILT_IN_FORMATS = new Map<string, number>([
    ['general', 0],
    ['0', 1],
    ['0.00', 2],
    ['#,##0', 3],
    ['#,##0.00', 4],
    ['0%', 9],
    ['0.00%', 10],
    ['mm-dd-yy', 14],
    ['h:mm', 20]
])

const FIRST_CUSTOM_FORMAT = 164

function color(value: XlsxColor): string {
    const hex = value.replace('#', '').toUpperCase()
    return `<color rgb="${hex.length === 6 ? `FF${hex}` : hex}"/>`
}

function fontXml(font: XlsxFont): string {
    return [
        '<font>',
        font.bold ? '<b/>' : '',
        font.italic ? '<i/>' : '',
        font.underline ? '<u/>' : '',
        `<sz val="${font.size ?? 11}"/>`,
        font.color ? color(font.color) : '',
        `<name val="${escapeXml(font.name ?? 'Calibri')}"/>`,
        '</font>'
    ].join('')
}

function fillXml(value: XlsxColor): string {
    const hex = value.replace('#', '').toUpperCase()
    const rgb = hex.length === 6 ? `FF${hex}` : hex
    return `<fill><patternFill patternType="solid"><fgColor rgb="${rgb}"/><bgColor indexed="64"/></patternFill></fill>`
}

function dxfFontXml(font: XlsxFont): string {
    const parts = [
        font.bold ? '<b/>' : '',
        font.italic ? '<i/>' : '',
        font.underline ? '<u/>' : '',
        font.color ? color(font.color) : ''
    ].join('')
    return parts === '' ? '' : `<font>${parts}</font>`
}

function dxfFillXml(value: XlsxColor): string {
    const hex = value.replace('#', '').toUpperCase()
    const rgb = hex.length === 6 ? `FF${hex}` : hex
    return `<fill><patternFill><bgColor rgb="${rgb}"/></patternFill></fill>`
}

function dxfXml(style: XlsxStyle): string {
    return `<dxf>${style.font ? dxfFontXml(style.font) : ''}${
        style.fill ? dxfFillXml(style.fill) : ''
    }</dxf>`
}

function sideXml(name: string, side: XlsxBorderSide | undefined): string {
    if (!side) return `<${name}/>`
    return `<${name} style="${side.style ?? 'thin'}">${side.color ? color(side.color) : ''}</${name}>`
}

function borderXml(border: XlsxBorder): string {
    return [
        '<border>',
        sideXml('left', border.left),
        sideXml('right', border.right),
        sideXml('top', border.top),
        sideXml('bottom', border.bottom),
        '<diagonal/>',
        '</border>'
    ].join('')
}

const VERTICAL: Record<string, string> = { top: 'top', middle: 'center', bottom: 'bottom' }

function alignmentXml(alignment: XlsxAlignment): string {
    const parts = [
        alignment.horizontal ? ` horizontal="${alignment.horizontal}"` : '',
        alignment.vertical ? ` vertical="${VERTICAL[alignment.vertical]}"` : '',
        alignment.wrap ? ' wrapText="1"' : '',
        alignment.rotation === undefined ? '' : ` textRotation="${alignment.rotation}"`,
        alignment.indent === undefined ? '' : ` indent="${alignment.indent}"`
    ].join('')
    return parts === '' ? '' : `<alignment${parts}/>`
}

interface StyleIds {
    numFmt: number
    font: number
    fill: number
    border: number
}

function applied(name: string, id: number): string {
    return id ? ` apply${name}="1"` : ''
}

function cellRecord(ids: StyleIds, alignment: string): string {
    const head =
        `<xf numFmtId="${ids.numFmt}" fontId="${ids.font}" fillId="${ids.fill}"` +
        ` borderId="${ids.border}" xfId="0"` +
        applied('NumberFormat', ids.numFmt) +
        applied('Font', ids.font) +
        applied('Fill', ids.fill) +
        applied('Border', ids.border) +
        (alignment ? ' applyAlignment="1"' : '')
    return alignment ? `${head}>${alignment}</xf>` : `${head}/>`
}

class Pool {
    readonly entries: string[] = []
    readonly #index = new Map<string, number>()

    constructor(...initial: string[]) {
        for (const entry of initial) this.intern(entry)
    }

    intern(xml: string): number {
        const found = this.#index.get(xml)
        if (found !== undefined) return found

        const id = this.entries.push(xml) - 1
        this.#index.set(xml, id)
        return id
    }

    get size(): number {
        return this.entries.length
    }

    join(): string {
        return this.entries.join('')
    }
}

export class StyleTable {
    #fonts = new Pool(fontXml({}))
    #fills = new Pool(
        '<fill><patternFill patternType="none"/></fill>',
        '<fill><patternFill patternType="gray125"/></fill>'
    )
    #borders = new Pool(borderXml({}))
    #formats = new Pool()
    #cells = new Pool()
    #dxfs = new Pool()

    constructor() {
        this.add({})
    }

    #formatId(code: string | undefined): number {
        if (code === undefined) return 0
        const builtIn = BUILT_IN_FORMATS.get(code.toLowerCase())
        if (builtIn !== undefined) return builtIn

        return FIRST_CUSTOM_FORMAT + this.#formats.intern(code)
    }

    add(style: XlsxStyle): number {
        const ids = {
            numFmt: this.#formatId(style.numberFormat),
            font: style.font ? this.#fonts.intern(fontXml(style.font)) : 0,
            fill: style.fill ? this.#fills.intern(fillXml(style.fill)) : 0,
            border: style.border ? this.#borders.intern(borderXml(style.border)) : 0
        }
        const alignment = style.alignment ? alignmentXml(style.alignment) : ''
        return this.#cells.intern(cellRecord(ids, alignment))
    }

    addDxf(style: XlsxStyle): number {
        return this.#dxfs.intern(dxfXml(style))
    }

    get size(): number {
        return this.#cells.size
    }

    get dxfCount(): number {
        return this.#dxfs.size
    }

    toXml(): string {
        const formats = this.#formats.size
            ? `<numFmts count="${this.#formats.size}">${this.#formats.entries
                  .map(
                      (code, index) =>
                          `<numFmt numFmtId="${FIRST_CUSTOM_FORMAT + index}" formatCode="${escapeXml(code)}"/>`
                  )
                  .join('')}</numFmts>`
            : ''

        return (
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
            '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
            formats +
            `<fonts count="${this.#fonts.size}">${this.#fonts.join()}</fonts>` +
            `<fills count="${this.#fills.size}">${this.#fills.join()}</fills>` +
            `<borders count="${this.#borders.size}">${this.#borders.join()}</borders>` +
            '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
            `<cellXfs count="${this.#cells.size}">${this.#cells.join()}</cellXfs>` +
            (this.#dxfs.size
                ? `<dxfs count="${this.#dxfs.size}">${this.#dxfs.join()}</dxfs>`
                : '') +
            '</styleSheet>'
        )
    }
}

export const BUILT_IN_STYLES = {
    header: { font: { bold: true } },
    date: { numberFormat: 'yyyy\\-mm\\-dd' },
    datetime: { numberFormat: 'yyyy\\-mm\\-dd\\ hh:mm' },
    currency: { numberFormat: '#,##0.00' },
    percent: { numberFormat: '0.00%' },
    integer: { numberFormat: '#,##0' }
} as const satisfies Record<string, XlsxStyle>
