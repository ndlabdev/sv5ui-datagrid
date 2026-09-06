import type { SavedView, SavedViewStorage } from './saved-views.types.js'

export const DEFAULT_VIEWS_KEY = 'sv5ui-datagrid:views'

function isView(value: unknown): value is SavedView {
    if (typeof value !== 'object' || value === null) return false
    const view = value as Partial<SavedView>
    return (
        typeof view.id === 'string' &&
        typeof view.name === 'string' &&
        typeof view.snapshot === 'object' &&
        view.snapshot !== null
    )
}

export function parseViews(raw: string | null): SavedView[] | null {
    if (!raw) return null
    try {
        const parsed: unknown = JSON.parse(raw)
        if (!Array.isArray(parsed)) return null
        const views = parsed.filter(isView)
        return views.length > 0 ? views : null
    } catch {
        return null
    }
}

export const localStorageViews: SavedViewStorage = {
    read(key) {
        if (typeof localStorage === 'undefined') return null
        try {
            return parseViews(localStorage.getItem(key))
        } catch {
            return null
        }
    },
    write(key, views) {
        if (typeof localStorage === 'undefined') return
        try {
            localStorage.setItem(key, JSON.stringify(views))
        } catch {
            return
        }
    }
}

export function mergeViews(seeded: SavedView[], stored: SavedView[] | null): SavedView[] {
    if (!stored) return seeded
    const byId = new Map(seeded.map((view) => [view.id, view]))
    for (const view of stored) byId.set(view.id, view)
    return [...byId.values()]
}
