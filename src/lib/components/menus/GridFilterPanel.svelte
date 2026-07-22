<script lang="ts" generics="TRow">
    import {
        Button,
        Checkbox,
        Input,
        Select,
        useClickOutside,
        useEscapeKeydown,
        useFocusTrap
    } from 'sv5ui'
    import type {
        DateFilterOp,
        NumberFilterOp,
        SetFilterValue,
        TextFilterOp
    } from '../../core/types/index.js'
    import {
        buildColumnFilter,
        draftFromFilter,
        filterTypeOf,
        getFiltering
    } from '../../features/filtering/index.js'
    import { getGridContext } from '../internal/context.js'
    import type { GridFilterPanelProps } from '../datagrid.types.js'
    import { datagridVariants } from '../datagrid.variants.js'
    import { getGridTheme } from '../internal/theme.js'

    let { column }: GridFilterPanelProps<TRow> = $props()

    const grid = getGridContext<TRow>()
    const filteringState = getFiltering(grid)!
    const slots = datagridVariants()
    const theme = getGridTheme()

    const type = $derived(filterTypeOf(column.def))
    const open = $derived(filteringState.filterFor === column.id)
    const active = $derived(column.id in filteringState.columnFilters)

    const textOps: { label: string; value: TextFilterOp }[] = [
        { label: 'Contains', value: 'contains' },
        { label: 'Equals', value: 'equals' },
        { label: 'Starts with', value: 'startsWith' },
        { label: 'Ends with', value: 'endsWith' },
        { label: 'Is blank', value: 'blank' }
    ]
    const numberOps: { label: string; value: NumberFilterOp }[] = [
        { label: '=', value: 'eq' },
        { label: '≠', value: 'neq' },
        { label: '>', value: 'gt' },
        { label: '≥', value: 'gte' },
        { label: '<', value: 'lt' },
        { label: '≤', value: 'lte' },
        { label: 'Between', value: 'between' },
        { label: 'Is blank', value: 'blank' }
    ]
    const dateOps: { label: string; value: DateFilterOp }[] = [
        { label: 'Equals', value: 'equals' },
        { label: 'Before', value: 'before' },
        { label: 'After', value: 'after' },
        { label: 'Between', value: 'between' }
    ]

    let op = $state<string>('contains')
    let value = $state('')
    let to = $state('')
    let boolValue = $state('true')
    let setSearch = $state('')
    let setSelected = $state.raw<SetFilterValue[]>([])

    const distinct = $derived(open && type === 'set' ? filteringState.distinctFor(column.id) : [])
    const distinctShown = $derived.by(() => {
        const query = setSearch.trim().toLowerCase()
        if (!query) return distinct
        return distinct.filter((entry) =>
            String(entry ?? '(blank)')
                .toLowerCase()
                .includes(query)
        )
    })

    $effect(() => {
        if (!open || !type) return
        const draft = draftFromFilter(type, filteringState.columnFilters[column.id])
        op = draft.op
        value = draft.value
        to = draft.to
        boolValue = draft.boolValue
        setSearch = ''
        setSelected = draft.setSelected
    })

    function apply() {
        const filter = type
            ? buildColumnFilter(type, { op, value, to, boolValue, setSelected })
            : null
        filteringState.setColumnFilter(column.id, filter)
        filteringState.filterFor = null
    }

    function clear() {
        filteringState.setColumnFilter(column.id, null)
        filteringState.filterFor = null
    }

    function toggleValue(entry: SetFilterValue, checked: boolean) {
        setSelected = checked
            ? [...setSelected, entry]
            : setSelected.filter((candidate) => candidate !== entry)
    }

    let triggerElement = $state<HTMLElement | null>(null)
    let position = $state({ x: 0, y: 0 })

    function toggleOpen() {
        if (open) {
            filteringState.filterFor = null
            return
        }
        const rect = triggerElement?.getBoundingClientRect()
        if (rect) {
            position = {
                x: Math.max(8, Math.min(rect.right - 272, window.innerWidth - 280)),
                y: rect.bottom + 4
            }
        }
        filteringState.filterFor = column.id
    }

    function onClickOutside(event: PointerEvent) {
        if (triggerElement?.contains(event.target as Node)) return
        filteringState.filterFor = null
    }

    let panelElement = $state<HTMLElement | null>(null)
    useFocusTrap(() => (open ? panelElement : null))
</script>

{#if type}
    <span
        data-dg-noreorder
        class={active ? undefined : slots.menuButton({ class: theme('menuButton') })}
    >
        <Button
            bind:ref={triggerElement}
            variant="ghost"
            size="xs"
            icon="lucide:filter"
            color={active ? 'primary' : 'secondary'}
            aria-label={`Filter ${column.header}`}
            aria-expanded={open}
            tabindex={-1}
            onclick={toggleOpen}
        />
    </span>
    {#if open}
        <div
            bind:this={panelElement}
            role="dialog"
            aria-label={`Filter ${column.header}`}
            class={slots.filterPanel({ class: theme('filterPanel') })}
            style:left={`${position.x}px`}
            style:top={`${position.y}px`}
            use:useClickOutside={{ handler: onClickOutside }}
            use:useEscapeKeydown={{ handler: () => (filteringState.filterFor = null) }}
        >
            {#if type === 'text' || type === 'number' || type === 'date'}
                <Select
                    items={type === 'text' ? textOps : type === 'number' ? numberOps : dateOps}
                    bind:value={op}
                    aria-label="Filter operator"
                />
                {#if op !== 'blank'}
                    <Input
                        type={type === 'number' ? 'number' : type === 'date' ? 'date' : 'text'}
                        placeholder={type === 'text' ? 'Value...' : undefined}
                        bind:value
                    />
                    {#if op === 'between'}
                        <Input
                            type={type === 'number' ? 'number' : 'date'}
                            placeholder="To..."
                            bind:value={to}
                        />
                    {/if}
                {/if}
            {:else if type === 'set'}
                <Input placeholder="Search values..." icon="lucide:search" bind:value={setSearch} />
                <div class="max-h-56 space-y-0.5 overflow-auto">
                    {#each distinctShown as entry (entry)}
                        <div class={slots.chooserItem({ class: theme('chooserItem') })}>
                            <Checkbox
                                label={entry === null ? '(blank)' : String(entry)}
                                checked={setSelected.includes(entry)}
                                onCheckedChange={(checked) => toggleValue(entry, checked)}
                            />
                        </div>
                    {/each}
                </div>
            {:else if type === 'boolean'}
                <Select
                    items={[
                        { label: 'True', value: 'true' },
                        { label: 'False', value: 'false' }
                    ]}
                    bind:value={boolValue}
                    aria-label="Filter value"
                />
            {/if}
            <div class="flex justify-end gap-2 pt-1">
                <Button variant="ghost" size="sm" label="Clear" onclick={clear} />
                <Button size="sm" label="Apply" onclick={apply} />
            </div>
        </div>
    {/if}
{/if}
