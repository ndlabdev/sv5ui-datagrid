import {
    decodeSnapshot,
    encodeSnapshot,
    type GridState,
    sameSnapshot
} from '../../core/grid/index.js'
import { type GridFeature } from '../../core/types/index.js'
import type { SavedView, SavedViewsOptions, SavedViewStorage } from './saved-views.types.js'
import { readShareParam, withShareParam } from './share-param.js'
import { DEFAULT_VIEWS_KEY, localStorageViews, mergeViews } from './storage.js'

export const SAVED_VIEWS = 'savedViews'

function newId(): string {
    return `view-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export class SavedViews<TRow> {
    views = $state.raw<SavedView[]>([])
    activeId = $state<string | null>(null)

    readonly key: string

    #grid: GridState<TRow>
    #storage: SavedViewStorage | null
    #onChange?: (views: SavedView[]) => void

    constructor(grid: GridState<TRow>, options: SavedViewsOptions) {
        this.#grid = grid
        this.key = options.key ?? DEFAULT_VIEWS_KEY
        this.#storage = options.storage === undefined ? localStorageViews : options.storage
        this.#onChange = options.onChange
        this.views = mergeViews(options.views ?? [], this.#storage?.read(this.key) ?? null)
    }

    get active(): SavedView | null {
        return this.views.find((view) => view.id === this.activeId) ?? null
    }

    get modified(): boolean | null {
        const active = this.active
        if (!active) return null
        return !sameSnapshot(this.#grid.api.getState(), active.snapshot)
    }

    #commit(views: SavedView[]): void {
        this.views = views
        this.#storage?.write(this.key, views)
        this.#onChange?.(views)
    }

    save = (name: string): SavedView | null => {
        const trimmed = name.trim()
        if (trimmed === '') return null

        const view: SavedView = { id: newId(), name: trimmed, snapshot: this.#grid.api.getState() }
        this.#commit([...this.views, view])
        this.activeId = view.id
        return view
    }

    update = (id: string): boolean => {
        const snapshot = this.#grid.api.getState()
        let found = false
        const next = this.views.map((view) => {
            if (view.id !== id) return view
            found = true
            return { ...view, snapshot }
        })
        if (found) this.#commit(next)
        return found
    }

    rename = (id: string, name: string): boolean => {
        const trimmed = name.trim()
        if (trimmed === '') return false

        let found = false
        const next = this.views.map((view) => {
            if (view.id !== id) return view
            found = true
            return { ...view, name: trimmed }
        })
        if (found) this.#commit(next)
        return found
    }

    remove = (id: string): boolean => {
        const next = this.views.filter((view) => view.id !== id)
        if (next.length === this.views.length) return false
        this.#commit(next)
        if (this.activeId === id) this.activeId = null
        return true
    }

    apply = (id: string): boolean => {
        const view = this.views.find((candidate) => candidate.id === id)
        if (!view) return false
        this.#grid.api.setState(view.snapshot)
        this.activeId = id
        return true
    }

    revert = (): boolean => {
        const active = this.active
        if (!active) return false
        this.#grid.api.setState(active.snapshot)
        return true
    }

    shareToken = (): Promise<string> => encodeSnapshot(this.#grid.api.getState())

    shareLink = async (base?: string): Promise<string | null> => {
        const href = base ?? (typeof location === 'undefined' ? null : location.href)
        if (href === null) return null

        return withShareParam(href, await this.shareToken())
    }

    applyToken = async (token: string): Promise<boolean> => {
        const snapshot = await decodeSnapshot(token)
        if (!snapshot) return false
        this.#grid.api.setState(snapshot)
        this.activeId = null
        return true
    }

    applyLink = async (href?: string): Promise<boolean> => {
        const source = href ?? (typeof location === 'undefined' ? null : location.href)
        if (source === null) return false

        const token = readShareParam(source)
        return token === null ? false : this.applyToken(token)
    }
}

export function savedViews<TRow>(options: SavedViewsOptions = {}): GridFeature<TRow> {
    return {
        id: SAVED_VIEWS,
        createState: (grid) => new SavedViews(grid, options),
        createApi: (grid) => {
            const state = getSavedViews(grid)!
            return {
                saveView: state.save,
                applyView: state.apply,
                removeView: state.remove,
                shareGridLink: state.shareLink,
                applyGridLink: state.applyLink
            }
        }
    }
}

export function getSavedViews<TRow>(grid: GridState<TRow>): SavedViews<TRow> | undefined {
    return grid.feature<SavedViews<TRow>>(SAVED_VIEWS)
}

declare module '../../core/types/api.js' {
    interface GridApi {
        saveView?: (name: string) => unknown
        applyView?: (id: string) => boolean
        removeView?: (id: string) => boolean
        shareGridLink?: (base?: string) => Promise<string | null>
        applyGridLink?: (href?: string) => Promise<boolean>
    }
}
