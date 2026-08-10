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

    // Pushes what the box produced, and nothing else. Reading `quick` as a
    // dependency too made one effect of the two directions: a `setQuickFilter`
    // from app code woke it, and it wrote the box's own value back over the
    // call in the same flush.
    $effect(() => {
        const query = search.debounced
        untrack(() => {
            if (filteringState && filteringState.quick !== query) {
                filteringState.setQuickFilter(query)
            }
        })
    })

    // The other direction, so a filter set from code shows in the box.
    // Immediately rather than through the debounce: a keystroke still in
    // flight would otherwise land after it and put the old query back.
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
