<script lang="ts">
    import { untrack } from 'svelte'
    import { Input, useDebouncedState } from 'sv5ui'
    import { getFiltering } from '../../features/filtering/index.js'
    import { getGridContext } from '../internal/context.js'
    import type { GridQuickFilterProps } from '../datagrid.types.js'

    let { placeholder, debounce = 200, class: className }: GridQuickFilterProps = $props()

    const grid = getGridContext()
    const filteringState = getFiltering(grid)
    const search = useDebouncedState(
        untrack(() => filteringState?.quick ?? ''),
        untrack(() => debounce)
    )

    $effect(() => {
        const query = search.debounced
        untrack(() => {
            if (filteringState && filteringState.quick !== query) {
                filteringState.setQuickFilter(query)
            }
        })
    })

    $effect(() => {
        const query = filteringState?.quick ?? ''
        untrack(() => {
            if (query !== search.debounced) search.setImmediate(query)
        })
    })
</script>

{#if filteringState}
    <Input
        placeholder={placeholder ?? grid.labels.search}
        icon="lucide:search"
        class={className}
        bind:value={search.current}
    />
{/if}
