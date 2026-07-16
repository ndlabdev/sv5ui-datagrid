import type { GridState } from './grid.svelte.js'
import type { PipelineStage, RowNode } from './types.js'

export const PIPELINE_ORDER = {
    filter: 100,
    sort: 200,
    group: 300,
    flatten: 400,
    pinSplit: 500,
    window: 900
} as const

export interface Pipeline<TRow> {
    output: () => RowNode<TRow>[]
    before: (order: number) => () => RowNode<TRow>[]
}

function memo<T>(fn: () => T): () => T {
    const value = $derived.by(fn)
    return () => value
}

export function composePipeline<TRow>(
    source: () => RowNode<TRow>[],
    stages: PipelineStage<TRow>[],
    grid: GridState<TRow>
): Pipeline<TRow> {
    const steps: { order: number; read: () => RowNode<TRow>[] }[] = [
        { order: Number.NEGATIVE_INFINITY, read: source }
    ]

    let output = source
    for (const stage of stages.toSorted((a, b) => a.order - b.order)) {
        const previous = output
        output = memo(() => stage.transform(previous(), grid))
        steps.push({ order: stage.order, read: output })
    }

    return {
        output,
        before: (order) => steps.findLast((step) => step.order < order)!.read
    }
}
