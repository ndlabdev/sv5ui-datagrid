import type { CellValueReader, ColumnDef, RowNode } from '../../core/types/index.js'
import { readCell, readerToken } from '../../core/grid/index.js'
import { formatCellText, isBlank } from '../../core/utils/index.js'

const searchTexts = new WeakMap<object, { signature: string; text: string }>()

const CELL_BREAK = ' '

interface SearchColumn<TRow> {
    def: ColumnDef<TRow>
    reader: CellValueReader<TRow> | undefined
}

function searchTextOf<TRow>(
    node: RowNode<TRow>,
    columns: SearchColumn<TRow>[],
    locale?: string
): string {
    let text = ''
    for (const { def, reader } of columns) {
        const value = readCell(node, def, reader)
        if (isBlank(value)) continue

        const raw = String(value)
        text += raw.toLowerCase() + CELL_BREAK
        const drawn = formatCellText(value, def, locale)
        if (drawn !== undefined && drawn !== raw) text += drawn.toLowerCase() + CELL_BREAK
    }
    return text
}

export function quickFilterNodes<TRow>(
    nodes: RowNode<TRow>[],
    columns: ColumnDef<TRow>[],
    query: string,
    options: {
        locale?: string
        read?: (def: ColumnDef<TRow>) => CellValueReader<TRow> | undefined
    } = {}
): RowNode<TRow>[] {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return nodes

    const { locale, read } = options

    const targets: SearchColumn<TRow>[] = columns.map((def) => ({ def, reader: read?.(def) }))

    const signature =
        locale +
        CELL_BREAK +
        targets.map(({ def, reader }) => `${def.id}#${readerToken(reader)}`).join(',')

    return nodes.filter((node) => {
        const row = node.row
        if (row === null || typeof row !== 'object') {
            return searchTextOf(node, targets, locale).includes(normalized)
        }

        let entry = searchTexts.get(row)
        if (entry === undefined || entry.signature !== signature) {
            entry = { signature, text: searchTextOf(node, targets, locale) }
            searchTexts.set(row, entry)
        }
        return entry.text.includes(normalized)
    })
}
