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
    import type { FilterJoin, SetFilterValue } from '../../core/types/index.js'
    import {
        buildColumnFilter,
        draftFromFilter,
        emptyCondition,
        emptyDraft,
        filterTypeOf,
        getFiltering,
        MAX_CONDITIONS
    } from '../../features/filtering/index.js'
    import { getGridContext } from '../internal/context.js'
    import type { GridFilterPanelProps } from '../datagrid.types.js'
    import { datagridVariants } from '../datagrid.variants.js'
    import { isInPortal, portal } from '../internal/portal.js'
    import { getGridTheme } from '../internal/theme.js'
    import GridFilterCondition from './GridFilterCondition.svelte'

    let { column }: GridFilterPanelProps<TRow> = $props()

    const grid = getGridContext<TRow>()
    const labels = $derived(grid.labels)
    const filteringState = getFiltering(grid)!
    const slots = datagridVariants()
    const theme = getGridTheme()

    /** Matches the `w-68` on the panel; used to keep it inside the viewport. */
    const PANEL_WIDTH = 272

    const type = $derived(filterTypeOf(column.def))
    const open = $derived(filteringState.filterFor === column.id)
    const active = $derived(column.id in filteringState.columnFilters)

    const joinOps: { label: string; value: FilterJoin }[] = $derived([
        { label: labels.and, value: 'and' },
        { label: labels.or, value: 'or' }
    ])

    // The draft is small, shallow and rebuilt on every open: a deep `$state`
    // buys `bind:` straight into a condition row and costs nothing at this
    // size. Row data would use `$state.raw`; a two-row form does not.
    let draft = $state(emptyDraft('text'))
    let setSearch = $state('')
    let setSelected = $state.raw<SetFilterValue[]>([])

    const distinct = $derived(open && type === 'set' ? filteringState.distinctFor(column.id) : [])
    const distinctShown = $derived.by(() => {
        const query = setSearch.trim().toLowerCase()
        if (!query) return distinct
        return distinct.filter((entry) =>
            String(entry ?? labels.blankValue)
                .toLowerCase()
                .includes(query)
        )
    })

    $effect(() => {
        if (!open || !type) return
        const next = draftFromFilter(type, filteringState.columnFilters[column.id])
        draft = next
        setSearch = ''
        setSelected = next.setSelected
    })

    function addCondition() {
        if (!type || draft.conditions.length >= MAX_CONDITIONS) return
        draft.conditions.push(emptyCondition(type))
    }

    function removeCondition() {
        if (draft.conditions.length > 1) draft.conditions.pop()
    }

    function apply() {
        const filter = type ? buildColumnFilter(type, { ...draft, setSelected }) : null
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

    // Viewport coordinates from `getBoundingClientRect`, so `left` is the
    // right property here even under RTL - a logical inset would mirror a
    // position that is already absolute and land the panel off-screen.
    function anchor() {
        if (!triggerElement) return
        const rect = triggerElement.getBoundingClientRect()
        position = {
            x: Math.max(8, Math.min(rect.right - PANEL_WIDTH, window.innerWidth - PANEL_WIDTH - 8)),
            y: rect.bottom + 4
        }
    }

    // Anchor the panel to its trigger whenever it opens — however it opened.
    // Positioning only inside the click handler left the panel at the top-left
    // corner when opened from the column menu, which sets `filterFor` directly.
    // `$effect.pre` runs before the panel is inserted, so it never flashes at
    // the wrong spot.
    $effect.pre(() => {
        if (!open) return
        anchor()
    })

    /**
     * The panel is fixed to the viewport, so scrolling the grid moves its
     * trigger out from under it. Re-anchoring on every scroll keeps the two
     * together; the listener is on capture so it hears the grid's own
     * scroller, not just the window.
     */
    $effect(() => {
        if (!open) return
        const reanchor = () => anchor()
        window.addEventListener('scroll', reanchor, true)
        window.addEventListener('resize', reanchor)
        return () => {
            window.removeEventListener('scroll', reanchor, true)
            window.removeEventListener('resize', reanchor)
        }
    })

    function toggleOpen() {
        filteringState.filterFor = open ? null : column.id
    }

    function onClickOutside(event: PointerEvent) {
        if (triggerElement?.contains(event.target as Node)) return
        // Picking an operator or a join is not leaving the panel, even though
        // the listbox lives in a portal outside it.
        if (isInPortal(event.target)) return
        filteringState.filterFor = null
    }

    let panelElement = $state<HTMLElement | null>(null)
    useFocusTrap(() => (open ? panelElement : null))
</script>

{#if type}
    <span data-dg-noreorder class={slots.menuButton({ class: theme('menuButton') })}>
        <Button
            bind:ref={triggerElement}
            variant="ghost"
            size="xs"
            icon="lucide:filter"
            color={active ? 'primary' : 'secondary'}
            aria-label={labels.filterColumn(column.header)}
            aria-expanded={open}
            tabindex={-1}
            onclick={toggleOpen}
        />
    </span>
    {#if open}
        <div
            use:portal
            bind:this={panelElement}
            role="dialog"
            aria-label={labels.filterColumn(column.header)}
            class={slots.filterPanel({ class: theme('filterPanel') })}
            style:left={`${position.x}px`}
            style:top={`${position.y}px`}
            use:useClickOutside={{ handler: onClickOutside }}
            use:useEscapeKeydown={{ handler: () => (filteringState.filterFor = null) }}
        >
            {#if type === 'text' || type === 'number' || type === 'date'}
                {#each draft.conditions as condition, index (index)}
                    {#if index > 0}
                        <Select
                            items={joinOps}
                            bind:value={draft.join}
                            aria-label={labels.combineConditions}
                        />
                    {/if}
                    <GridFilterCondition {type} {condition} ordinal={index + 1} />
                {/each}
                <!-- Wraps because a long translation ("Groß-/Kleinschreibung
                     beachten") takes both lines and would otherwise push the
                     button out through the panel's right edge. -->
                <div class="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 pt-0.5">
                    {#if type === 'text'}
                        <Checkbox
                            label={labels.matchCase}
                            bind:checked={draft.caseSensitive}
                            size="sm"
                        />
                    {:else}
                        <span></span>
                    {/if}
                    {#if draft.conditions.length < MAX_CONDITIONS}
                        <Button
                            variant="ghost"
                            size="xs"
                            icon="lucide:plus"
                            label={labels.addCondition}
                            onclick={addCondition}
                        />
                    {:else}
                        <Button
                            variant="ghost"
                            size="xs"
                            icon="lucide:minus"
                            label={labels.removeCondition}
                            onclick={removeCondition}
                        />
                    {/if}
                </div>
            {:else if type === 'set'}
                <Input
                    placeholder={labels.searchValues}
                    icon="lucide:search"
                    bind:value={setSearch}
                />
                <div class="max-h-56 space-y-0.5 overflow-auto">
                    {#each distinctShown as entry (entry)}
                        <div class={slots.chooserItem({ class: theme('chooserItem') })}>
                            <Checkbox
                                label={entry === null ? labels.blankValue : String(entry)}
                                checked={setSelected.includes(entry)}
                                onCheckedChange={(checked) => toggleValue(entry, checked)}
                            />
                        </div>
                    {/each}
                </div>
            {:else if type === 'boolean'}
                <Select
                    items={[
                        { label: labels.yes, value: 'true' },
                        { label: labels.no, value: 'false' }
                    ]}
                    bind:value={draft.boolValue}
                    aria-label={labels.filterValue(1)}
                />
            {/if}
            <div class="flex justify-end gap-2 pt-1">
                <Button variant="ghost" size="sm" label={labels.clear} onclick={clear} />
                <Button size="sm" label={labels.apply} onclick={apply} />
            </div>
        </div>
    {/if}
{/if}
