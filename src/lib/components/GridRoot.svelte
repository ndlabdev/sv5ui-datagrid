<script lang="ts" generics="TRow">
    import { untrack } from 'svelte'
    import { setGridContext } from './context.js'
    import type { GridRootProps } from './datagrid.types.js'
    import { datagridVariants } from './datagrid.variants.js'
    import GridStatePersistence from './GridStatePersistence.svelte'

    let { grid, persistState, class: className, children }: GridRootProps<TRow> = $props()

    setGridContext(untrack(() => grid))

    const slots = $derived(datagridVariants({ density: grid.density }))
</script>

{#if persistState}
    <GridStatePersistence {grid} options={persistState} />
{/if}

<div class={slots.root({ class: className })}>
    <div aria-live="polite" class="sr-only">{grid.announcer.message}</div>
    {@render children?.()}
</div>
