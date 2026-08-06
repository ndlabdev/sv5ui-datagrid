<script lang="ts" generics="TRow">
    import { untrack } from 'svelte'
    import { setGridContext } from '../internal/context.js'
    import { setGridTheme } from '../internal/theme.js'
    import { registerDataGridIcons } from '../internal/icons.js'
    import { getDataGridConfig } from '../datagrid.config.js'
    import type { GridRootProps } from '../datagrid.types.js'
    import { datagridVariants } from '../datagrid.variants.js'
    import GridStatePersistence from './GridStatePersistence.svelte'

    let { grid, persistState, ui, class: className, children }: GridRootProps<TRow> = $props()

    registerDataGridIcons()

    setGridContext(untrack(() => grid))
    setGridTheme(() => ui)

    // Written back once so toggle, snapshot and rendering read one value.
    untrack(() => {
        if (grid.configuredDensity === undefined) {
            grid.density = getDataGridConfig().defaultVariants.density
        }
    })

    const config = getDataGridConfig()
    const slots = $derived(datagridVariants({ density: grid.density }))
</script>

{#if persistState}
    <GridStatePersistence {grid} options={persistState} />
{/if}

<div class={slots.root({ class: [config.slots.root, className, ui?.root] })}>
    <div aria-live="polite" class="sr-only">{grid.announcer.message}</div>
    {@render children?.()}
</div>
