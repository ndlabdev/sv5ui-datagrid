import type { GridState } from '../core/grid.svelte.js'
import { getPagination } from '../features/pagination/index.js'
import { getVirtualization } from '../features/virtualization/index.js'

export function windowStartOf<TRow>(grid: GridState<TRow>): number {
    const virtualization = getVirtualization(grid)
    if (virtualization) return virtualization.virtualizer.range.start

    const pagination = getPagination(grid)
    if (pagination?.pageSize) return (pagination.page - 1) * pagination.pageSize

    return 0
}
