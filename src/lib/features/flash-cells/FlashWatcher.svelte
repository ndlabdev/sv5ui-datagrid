<script lang="ts">
    import { untrack } from 'svelte'
    import { getGridContext } from '../../components/internal/context.js'
    import { getFlashCells } from './flash-cells.svelte.js'

    const grid = getGridContext()
    const flash = getFlashCells(untrack(() => grid))

    $effect(() => {
        const nodes = grid.nodes
        const columns = grid.columns.visible
        void nodes
        void columns

        untrack(() => flash?.sweep())
    })

    $effect(() => () => flash?.stop())
</script>
