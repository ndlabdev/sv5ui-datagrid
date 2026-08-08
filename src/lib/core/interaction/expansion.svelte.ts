import type { EventBus } from '../grid/events.js'
import { emptyIdSet, idSetOf, idSetWith, idSetWithout } from '../utils/id-set.js'
import { mutator } from '../utils/reactivity.js'
import type { GridEventMap } from '../types/index.js'

export class ExpansionModel {
    expandedIds = $state.raw<ReadonlySet<string>>(emptyIdSet())
    enabled = $state(false)

    #events: EventBus<GridEventMap>

    constructor(events: EventBus<GridEventMap>) {
        this.#events = events
    }

    isExpanded(id: string): boolean {
        return this.expandedIds.has(id)
    }

    // `mutator`: the set is replaced rather than patched, so reading it here
    // would subscribe a caller to a value that never compares equal. See its doc.
    expand = mutator((id: string): void => {
        if (this.expandedIds.has(id)) return
        this.expandedIds = idSetWith(this.expandedIds, id)
        this.#events.emit('rowExpanded', { id, expanded: true })
    })

    collapse = mutator((id: string): void => {
        if (!this.expandedIds.has(id)) return
        this.expandedIds = idSetWithout(this.expandedIds, id)
        this.#events.emit('rowExpanded', { id, expanded: false })
    })

    toggle = mutator((id: string): void => {
        if (this.expandedIds.has(id)) {
            this.collapse(id)
        } else {
            this.expand(id)
        }
    })

    expandAll = (ids: Iterable<string>): void => {
        this.expandedIds = idSetOf(ids)
    }

    collapseAll = (): void => {
        this.expandedIds = emptyIdSet()
    }

    getExpanded = (): string[] => [...this.expandedIds]

    setExpanded = (ids: string[]): void => {
        this.expandedIds = idSetOf(ids)
    }
}
