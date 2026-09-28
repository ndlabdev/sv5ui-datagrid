import type { RowNode } from '../../core/types/index.js'

type Order<TRow> = (siblings: RowNode<TRow>[]) => RowNode<TRow>[]

interface Block<TRow> {
    head: RowNode<TRow>
    body: RowNode<TRow>[]
}

export function reorderGroups<TRow>(run: RowNode<TRow>[], order: Order<TRow>): RowNode<TRow>[] {
    if (run.length < 2) return run

    const level = run[0]!.meta?.level ?? 0
    const blocks: Block<TRow>[] = []

    for (const node of run) {
        if ((node.meta?.level ?? 0) === level) blocks.push({ head: node, body: [] })
        else blocks[blocks.length - 1]?.body.push(node)
    }

    if (blocks.some((block) => block.head.meta?.expandable !== true)) return run

    const byId = new Map(blocks.map((block) => [block.head.id, block]))
    return order(blocks.map((block) => block.head)).flatMap((head) => {
        const block = byId.get(head.id)
        if (!block) return [head]
        return [head, ...reorderGroups(block.body, order)]
    })
}
