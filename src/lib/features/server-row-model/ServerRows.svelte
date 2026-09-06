<script lang="ts">
    import { untrack } from 'svelte'
    import { getVirtualization } from '../virtualization/index.js'
    import { getGridContext } from '../../components/internal/context.js'
    import { getServerRowModel } from './server-row-model.svelte.js'

    // Contributed by `serverRowModel()`. It draws nothing: it exists because a
    // feature is built in `createDataGrid`, where there is no effect context,
    // and fetching rows is all effects.
    const grid = getGridContext()

    const model = getServerRowModel(untrack(() => grid))
    const virtualization = getVirtualization(untrack(() => grid))
    const groupKeysOf = model?.groupKeysOf
    const isChildOf = model?.isChildOf

    $effect(() => {
        untrack(() => model?.start())
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
