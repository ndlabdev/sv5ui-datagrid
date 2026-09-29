import type { RowNode } from '../../core/types/index.js'

type Order<TRow> = (siblings: RowNode<TRow>[]) => RowNode<TRow>[]

interface Block<TRow> {
    head: RowNode<TRow>
    body: RowNode<TRow>[]
}

function firstHead<TRow>(run: RowNode<TRow>[], level: number): number {
    for (let at = 0; at < run.length; at++) {
        const meta = run[at]!.meta
        if ((meta?.level ?? 0) === level && meta?.expandable === true) return at
    }
    return -1
}

function blocksFrom<TRow>(
    run: RowNode<TRow>[],
    level: number,
    start: number
): Block<TRow>[] | undefined {
    const blocks: Block<TRow>[] = []

    for (let at = start; at < run.length; at++) {
        const node = run[at]!
        if ((node.meta?.level ?? 0) !== level) {
            blocks[blocks.length - 1]?.body.push(node)
            continue
        }
        if (node.meta?.expandable !== true) return undefined
        blocks.push({ head: node, body: [] })
    }

    return blocks
}

export function reorderGroups<TRow>(run: RowNode<TRow>[], order: Order<TRow>): RowNode<TRow>[] {
    if (run.length < 2) return run

    const level = run[0]!.meta?.level ?? 0
    const start = firstHead(run, level)
    if (start < 0) return run

    const blocks = blocksFrom(run, level, start)
    if (!blocks) return run

    const byId = new Map(blocks.map((block) => [block.head.id, block]))
    const sorted = order(blocks.map((block) => block.head)).flatMap((head) => {
        const block = byId.get(head.id)
        if (!block) return [head]
        return [head, ...reorderGroups(block.body, order)]
    })

    return start === 0 ? sorted : [...run.slice(0, start), ...sorted]
}

export function alongFirstMeasure<TRow>(
    rows: RowNode<TRow>[],
    idAt: (groupId: string) => string,
    sort: (nodes: RowNode<TRow>[]) => RowNode<TRow>[]
): (siblings: RowNode<TRow>[]) => RowNode<TRow>[] {
    const byId = new Map(rows.map((node) => [node.id, node]))

    const merged = (head: RowNode<TRow>): RowNode<TRow> => {
        const measured = byId.get(idAt(head.id))
        if (!measured) return head
        return { ...head, row: { ...(measured.row as object), ...(head.row as object) } as TRow }
    }

    return (siblings) => sort(siblings.map(merged)).map((node) => byId.get(node.id) ?? node)
}
