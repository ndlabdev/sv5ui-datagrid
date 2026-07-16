<script lang="ts">
    import { untrack } from 'svelte'
    import { Input, useDebouncedState } from 'sv5ui'
    import { getFiltering } from '../features/filtering/index.js'
    import { getGridContext } from './context.js'
    import type { GridQuickFilterProps } from './datagrid.types.js'

    let {
        placeholder = 'Search...',
        debounce = 200,
        class: className
    }: GridQuickFilterProps = $props()

    const grid = getGridContext()
    const filteringState = getFiltering(grid)
    const search = useDebouncedState(
        untrack(() => filteringState?.quick ?? ''),
        untrack(() => debounce)
    )

    $effect(() => {
        if (filteringState && filteringState.quick !== search.debounced) {
            filteringState.setQuickFilter(search.debounced)
        }
    })
</script>

{#if filteringState}
    <Input {placeholder} icon="lucide:search" class={className} bind:value={search.current} />
{/if}
