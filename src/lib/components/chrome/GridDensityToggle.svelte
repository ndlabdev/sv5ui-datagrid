<script lang="ts">
    import { Button } from 'sv5ui'
    import type { Density } from '../../core/types/index.js'
    import { getGridContext } from '../internal/context.js'
    import type { GridDensityToggleProps } from '../datagrid.types.js'

    let { class: className }: GridDensityToggleProps = $props()

    const grid = getGridContext()

    // Derived: a plain array would snapshot the language it mounted in.
    const options: { value: Density; icon: string; label: string }[] = $derived([
        { value: 'compact', icon: 'lucide:rows-4', label: grid.labels.densityCompact },
        { value: 'standard', icon: 'lucide:rows-3', label: grid.labels.densityStandard },
        { value: 'comfortable', icon: 'lucide:rows-2', label: grid.labels.densityComfortable }
    ])

    /** One setting, one tab stop: the arrows move between the three. */
    let container = $state<HTMLElement | null>(null)

    function move(step: number) {
        const from = options.findIndex((option) => option.value === grid.density)
        const next = (from + step + options.length) % options.length
        grid.density = options[next].value
        container?.querySelectorAll<HTMLElement>('[role="radio"]')[next]?.focus()
    }

    const STEPS: Record<string, number> = {
        ArrowRight: 1,
        ArrowDown: 1,
        ArrowLeft: -1,
        ArrowUp: -1
    }

    function onKeydown(event: KeyboardEvent) {
        const step = STEPS[event.key]
        if (step === undefined) return
        event.preventDefault()
        move(step)
    }
</script>

<div
    bind:this={container}
    role="radiogroup"
    tabindex={-1}
    aria-label={grid.labels.rowDensity}
    class={['flex items-center gap-1', className].join(' ')}
    onkeydown={onKeydown}
>
    {#each options as option (option.value)}
        <Button
            size="sm"
            icon={option.icon}
            variant={grid.density === option.value ? 'solid' : 'outline'}
            role="radio"
            aria-label={option.label}
            aria-checked={grid.density === option.value}
            tabindex={grid.density === option.value ? 0 : -1}
            onclick={() => (grid.density = option.value)}
        />
    {/each}
</div>
