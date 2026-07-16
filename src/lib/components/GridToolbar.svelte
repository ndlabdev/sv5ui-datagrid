<script lang="ts">
    import type { GridToolbarProps } from './datagrid.types.js'
    import { datagridVariants } from './datagrid.variants.js'

    let { class: className, children }: GridToolbarProps = $props()

    const slots = datagridVariants()
</script>

<div class={slots.toolbar({ class: className })}>
    {@render children?.()}
</div>
