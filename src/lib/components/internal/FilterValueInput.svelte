<script lang="ts">
    import { Input, useDebouncedState } from 'sv5ui'
    import { untrack } from 'svelte'

    let {
        value,
        type = 'text',
        debounce = 200,
        placeholder,
        label,
        class: className,
        onValue
    }: {
        value: unknown
        type?: 'text' | 'number'
        debounce?: number
        placeholder: string
        label: string
        class?: string
        onValue: (next: string) => void
    } = $props()

    const field = useDebouncedState(
        untrack(() => String(value ?? '')),
        untrack(() => debounce)
    )

    $effect(() => {
        const typed = String(field.debounced ?? '')
        untrack(() => {
            if (typed !== String(value ?? '')) onValue(typed)
        })
    })

    $effect(() => {
        const outside = String(value ?? '')
        untrack(() => {
            if (outside !== String(field.debounced ?? '')) field.setImmediate(outside)
        })
    })
</script>

<Input {type} class={className} {placeholder} aria-label={label} bind:value={field.current} />
