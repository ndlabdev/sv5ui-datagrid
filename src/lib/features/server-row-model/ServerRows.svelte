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

    // What the body draws while there is no answer yet, and if one never came.
    $effect(() => {
        if (!model) return
        grid.status = {
            loading: model.loading || !model.answered,
            error: model.error,
            onRetry: model.refresh
        }
    })

    // Cleared when the grid goes, and only then. Put on the effect above, the
    // teardown would run on every change it reacts to, blanking the status and
    // rewriting it in the same flush for no reason.
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
