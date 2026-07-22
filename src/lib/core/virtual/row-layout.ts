export interface RowLayout {
    readonly count: number
    readonly totalHeight: number
    sizeOf(index: number): number
    offsetOf(index: number): number
    indexAt(offset: number): number
}

export function fixedRowLayout(count: number, rowHeight: number): RowLayout {
    return {
        count,
        totalHeight: count * rowHeight,
        sizeOf: () => rowHeight,
        offsetOf: (index) => index * rowHeight,
        indexAt: (offset) => {
            if (count === 0) return 0
            return Math.min(count - 1, Math.max(0, Math.floor(offset / rowHeight)))
        }
    }
}

export function variableRowLayout(count: number, getHeight: (index: number) => number): RowLayout {
    const heights = new Float64Array(count)
    const tree = new Float64Array(count + 1)

    for (let i = 1; i <= count; i++) {
        heights[i - 1] = getHeight(i - 1)
        tree[i] += heights[i - 1]
        const parent = i + (i & -i)
        if (parent <= count) tree[parent] += tree[i]
    }

    let highestBit = 1
    while (highestBit * 2 <= count) highestBit *= 2

    function prefix(index: number): number {
        let sum = 0
        for (let i = index; i > 0; i -= i & -i) sum += tree[i]
        return sum
    }

    const totalHeight = prefix(count)

    return {
        count,
        totalHeight,
        sizeOf: (index) => heights[index] ?? 0,
        offsetOf: (index) => prefix(index),
        indexAt: (offset) => {
            if (count === 0) return 0
            if (offset <= 0) return 0

            let index = 0
            let remaining = offset
            for (let bit = highestBit; bit > 0; bit >>= 1) {
                const next = index + bit
                if (next <= count && tree[next] <= remaining) {
                    index = next
                    remaining -= tree[next]
                }
            }
            return Math.min(index, count - 1)
        }
    }
}
