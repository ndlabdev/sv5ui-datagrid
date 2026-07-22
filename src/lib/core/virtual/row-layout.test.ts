import { describe, expect, it } from 'vitest'
import { fixedRowLayout, variableRowLayout } from './row-layout.js'

describe('fixedRowLayout', () => {
    it('computes offsets and totals in O(1)', () => {
        const layout = fixedRowLayout(100, 40)
        expect(layout.totalHeight).toBe(4000)
        expect(layout.offsetOf(0)).toBe(0)
        expect(layout.offsetOf(10)).toBe(400)
        expect(layout.sizeOf(50)).toBe(40)
    })

    it('maps offsets back to clamped indices', () => {
        const layout = fixedRowLayout(100, 40)
        expect(layout.indexAt(0)).toBe(0)
        expect(layout.indexAt(399)).toBe(9)
        expect(layout.indexAt(400)).toBe(10)
        expect(layout.indexAt(-50)).toBe(0)
        expect(layout.indexAt(1_000_000)).toBe(99)
    })

    it('handles an empty list', () => {
        const layout = fixedRowLayout(0, 40)
        expect(layout.totalHeight).toBe(0)
        expect(layout.indexAt(100)).toBe(0)
    })
})

describe('variableRowLayout', () => {
    const heights = [40, 64, 96, 40, 40, 64, 96, 40, 40, 40]
    const layout = variableRowLayout(heights.length, (i) => heights[i])

    function naiveOffset(index: number): number {
        return heights.slice(0, index).reduce((sum, height) => sum + height, 0)
    }

    it('matches naive prefix sums for every offset', () => {
        expect.hasAssertions()
        for (let i = 0; i <= heights.length; i++) {
            if (i < heights.length) expect(layout.sizeOf(i)).toBe(heights[i])
            expect(layout.offsetOf(i)).toBe(naiveOffset(i))
        }
        expect(layout.totalHeight).toBe(naiveOffset(heights.length))
    })

    it('maps offsets to the row containing them', () => {
        expect.hasAssertions()
        for (let i = 0; i < heights.length; i++) {
            const start = naiveOffset(i)
            expect(layout.indexAt(start)).toBe(i)
            expect(layout.indexAt(start + heights[i] - 1)).toBe(i)
        }
        expect(layout.indexAt(-10)).toBe(0)
        expect(layout.indexAt(layout.totalHeight + 100)).toBe(heights.length - 1)
    })

    it('agrees with a naive implementation on randomized heights', () => {
        expect.hasAssertions()
        let seed = 42
        const random = () => {
            seed = (seed * 1103515245 + 12345) % 2147483648
            return seed / 2147483648
        }
        const count = 500
        const randomHeights = Array.from({ length: count }, () => 24 + Math.floor(random() * 80))
        const randomLayout = variableRowLayout(count, (i) => randomHeights[i])

        let running = 0
        for (let i = 0; i < count; i++) {
            expect(randomLayout.offsetOf(i)).toBeCloseTo(running, 6)
            const inside = running + randomHeights[i] / 2
            expect(randomLayout.indexAt(inside)).toBe(i)
            running += randomHeights[i]
        }
        expect(randomLayout.totalHeight).toBeCloseTo(running, 6)
    })
})
