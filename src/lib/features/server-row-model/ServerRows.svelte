<script lang="ts">
    import { untrack } from 'svelte'
    import { getVirtualization } from '../virtualization/index.js'
    import { getGridContext } from '../../components/internal/context.js'
    import { getServerRowModel } from './server-row-model.svelte.js'

    const grid = getGridContext()

    const model = getServerRowModel(untrack(() => grid))
    const virtualization = getVirtualization(untrack(() => grid))
    const groupKeysOf = model?.groupKeysOf
    const isChildOf = model?.isChildOf

    $effect(() => {
        untrack(() => model?.start())
    })

    $effect(() => {
        if (!model) return
        grid.status = {
            loading: model.loading || !model.answered,
            error: model.error,
            onRetry: model.refresh
        }
    })

    $effect(() => () => {
        grid.status = undefined
    })

    $effect(() => {
        const range = virtualization?.virtualizer.range
        if (range) untrack(() => model?.ensureRange(range.start, range.end))
    })

    $effect(() => {
        if (!model || !groupKeysOf) return
        return grid.events.on('rowExpanded', ({ id, expanded }) => {
            const node = grid.preWindowNodes.find((candidate) => candidate.id === id)
            if (!node) return

            if (expanded) void model.expandGroup(node, groupKeysOf(node))
            else if (isChildOf) model.collapseGroup(node, isChildOf(node))
        })
    })
</script>
