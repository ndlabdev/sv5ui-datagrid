export function emptyIds(): ReadonlySet<string> {
    return new Set<string>()
}

export function idsOf<TRow>(rows: TRow[], idOf: (row: TRow) => string): ReadonlySet<string> {
    return new Set(rows.map(idOf))
}
