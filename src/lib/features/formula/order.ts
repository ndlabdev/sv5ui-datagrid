export interface OrderResult {
    order: string[]
    cyclic: Set<string>
}

export function resolveOrder(dependencies: Map<string, string[]>): OrderResult {
    const order: string[] = []
    const cyclic = new Set<string>()

    const state = new Map<string, 'visiting' | 'done'>()

    const visit = (id: string, stack: string[]): boolean => {
        const seen = state.get(id)
        if (seen === 'done') return true
        if (seen === 'visiting') {
            const from = stack.indexOf(id)
            for (const member of stack.slice(from === -1 ? 0 : from)) cyclic.add(member)
            cyclic.add(id)
            return false
        }

        state.set(id, 'visiting')
        let clean = true
        for (const next of dependencies.get(id) ?? []) {
            if (!dependencies.has(next)) continue
            if (!visit(next, [...stack, id])) clean = false
        }
        state.set(id, 'done')

        if (clean) order.push(id)
        return clean
    }

    for (const id of dependencies.keys()) visit(id, [])

    return { order: order.filter((id) => !cyclic.has(id)), cyclic }
}
