export function emptyIdSet(): ReadonlySet<string> {
    return new Set()
}

export function idSetOf(ids: Iterable<string>): ReadonlySet<string> {
    return new Set(ids)
}

export function idSetWith(set: ReadonlySet<string>, id: string): ReadonlySet<string> {
    const next = new Set(set)
    next.add(id)
    return next
}

export function idSetWithout(set: ReadonlySet<string>, id: string): ReadonlySet<string> {
    const next = new Set(set)
    next.delete(id)
    return next
}
