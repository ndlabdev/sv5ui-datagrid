export interface SeenGroups {
    has: (id: string) => boolean
    add: (id: string) => void
}

export function createSeenGroups(): SeenGroups {
    const seen = new Set<string>()
    return {
        has: (id) => seen.has(id),
        add: (id) => {
            seen.add(id)
        }
    }
}
