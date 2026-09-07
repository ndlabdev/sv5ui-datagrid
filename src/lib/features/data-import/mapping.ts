import { type ColumnDef } from '../../core/types/index.js'

export type SourceValue = string | number | boolean | Date | null

export interface ColumnMapping {
    columnId: string
    sourceIndex: number | null
}

function fold(text: string): string {
    return text
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/đ/g, 'd')
        .replace(/Đ/g, 'D')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '')
}

const MIN_LOOSE_LENGTH = 4

function nearly(candidate: string, wanted: string): boolean {
    if (wanted.length < MIN_LOOSE_LENGTH || candidate.length < MIN_LOOSE_LENGTH) return false
    return candidate.startsWith(wanted) || wanted.startsWith(candidate)
}

function findFor(folded: string[], taken: Set<number>, byId: string, byHeader: string): number {
    const search = (wanted: string, accept: (candidate: string) => boolean): number => {
        if (wanted === '') return -1
        return folded.findIndex(
            (candidate, index) => !taken.has(index) && candidate !== '' && accept(candidate)
        )
    }

    const exact = search(byId, (candidate) => candidate === byId)
    if (exact >= 0) return exact

    const header = search(byHeader, (candidate) => candidate === byHeader)
    if (header >= 0) return header

    const loose = search(byHeader, (candidate) => nearly(candidate, byHeader))
    if (loose >= 0) return loose

    return search(byId, (candidate) => nearly(candidate, byId))
}

export function guessMapping<TRow>(
    columns: ColumnDef<TRow>[],
    headers: string[],
    remembered: Record<string, string> = {}
): ColumnMapping[] {
    const taken = new Set<number>()
    const folded = headers.map(fold)

    const mappings = columns.map<ColumnMapping>((column) => {
        const known = remembered[column.id]
        const at = typeof known === 'string' ? folded.indexOf(fold(known)) : -1

        if (at >= 0 && !taken.has(at)) {
            taken.add(at)
            return { columnId: column.id, sourceIndex: at }
        }
        return { columnId: column.id, sourceIndex: null }
    })

    for (const mapping of mappings) {
        if (mapping.sourceIndex !== null) continue

        const column = columns.find((entry) => entry.id === mapping.columnId)!
        const at = findFor(folded, taken, fold(column.id), fold(String(column.header ?? '')))

        if (at >= 0) {
            taken.add(at)
            mapping.sourceIndex = at
        }
    }

    return mappings
}

export function rememberMapping(
    mappings: ColumnMapping[],
    headers: string[]
): Record<string, string> {
    const out: Record<string, string> = {}
    for (const mapping of mappings) {
        const header = mapping.sourceIndex === null ? undefined : headers[mapping.sourceIndex]
        if (header !== undefined && header !== '') out[mapping.columnId] = header
    }
    return out
}
