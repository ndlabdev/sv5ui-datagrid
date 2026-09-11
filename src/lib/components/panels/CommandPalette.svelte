<script lang="ts" generics="TRow">
    import { untrack } from 'svelte'
    import { Command, type CommandGroup, Modal, useKbd } from 'sv5ui'
    import { getCommandPalette } from '../../features/command-palette/command-palette.svelte.js'
    import { datagridVariants } from '../datagrid.variants.js'
    import type { GridState } from '$lib/index.js'
    import { getGridContext } from '../internal/context.js'
    import { getGridTheme } from '../internal/theme.js'

    const slots = datagridVariants()

    let {
        grid: gridProp,
        hotkey = true,
        placeholder,
        emptyText,
        title
    }: {
        grid?: GridState<TRow>
        hotkey?: boolean
        placeholder?: string
        emptyText?: string

        title?: string
    } = $props()

    const grid = untrack(() => gridProp) ?? getGridContext<TRow>()
    const theme = getGridTheme(grid)

    const palette = $derived(getCommandPalette(grid))
    const t = $derived(grid.labels)

    let search = $state('')

    const groups: CommandGroup[] = $derived.by(() => {
        if (!palette?.open) return []
        const byGroup: Record<string, CommandGroup> = {}
        const ordered: CommandGroup[] = []
        for (const command of palette.commands) {
            const label = command.group ?? t.commandGroupDefault
            let bucket = byGroup[label]
            if (!bucket) {
                bucket = { id: label, label, items: [] }
                byGroup[label] = bucket
                ordered.push(bucket)
            }
            bucket.items.push({
                value: command.id,
                label: command.label,
                icon: command.icon,
                keywords: command.keywords,
                disabled: command.disabled,
                onSelect: () => palette.run(command)
            })
        }
        return ordered
    })

    function toggle() {
        search = ''
        palette?.toggle()
    }

    useKbd({
        shortcuts: { 'ctrl+k': toggle, 'meta+k': toggle },
        enabled: () => hotkey && Boolean(palette)
    })
</script>

{#if palette}
    <Modal
        open={palette.open}
        onOpenChange={(open) => {
            if (open) search = ''
            palette.open = open
        }}
        title={title ?? t.commandPaletteTitle}
        close={false}
        ui={{ content: slots.commandPalette({ class: theme('commandPalette') }) }}
    >
        {#snippet content()}
            <Command
                data-dg-command-palette
                {groups}
                placeholder={placeholder ?? t.commandPalettePlaceholder}
                emptyText={emptyText ?? t.commandPaletteEmpty}
                bind:search
                size="sm"
                icon="lucide:search"
            />
        {/snippet}
    </Modal>
{/if}
