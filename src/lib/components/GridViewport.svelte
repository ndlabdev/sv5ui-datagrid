<script lang="ts">
    import { getGridContext } from './context.js'
    import type { GridViewportProps } from './datagrid.types.js'
    import { datagridVariants } from './datagrid.variants.js'

    let { class: className, children }: GridViewportProps = $props()

    const grid = getGridContext()
    const slots = datagridVariants()
</script>

<div
    role="grid"
    aria-rowcount={grid.totalRows + 1}
    aria-colcount={grid.columns.visible.length}
    class={slots.viewport({ class: className })}
    style={grid.columns.style}
>
    {@render children?.()}
</div>
