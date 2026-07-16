<script lang="ts" generics="TRow">
    import { untrack } from 'svelte'
    import { setGridContext } from './context.js'
    import type { GridRootProps } from './datagrid.types.js'
    import { datagridVariants } from './datagrid.variants.js'

    let { grid, class: className, children }: GridRootProps<TRow> = $props()

    setGridContext(untrack(() => grid))

    const slots = datagridVariants()
</script>

<div class={slots.root({ class: className })}>
    {@render children?.()}
</div>
