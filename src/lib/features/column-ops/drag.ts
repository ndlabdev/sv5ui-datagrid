import { clamp } from '../../core/utils/math.js'

export interface DropTarget {
    index: number
    indicatorX: number
}

export function dropTargetIndex(
    contentX: number,
    offsets: number[],
    sourceIndex: number,
    range: { start: number; end: number }
): DropTarget {
    const count = offsets.length - 1
    let index = range.start
    while (
        index < range.end &&
        offsets[index] + (offsets[index + 1] - offsets[index]) / 2 < contentX
    ) {
        index += 1
    }

    index = clamp(index, range.start, range.end)
    const insertion = index > sourceIndex ? index - 1 : index
    return {
        index: clamp(insertion, range.start, Math.max(range.start, range.end - 1)),
        indicatorX: offsets[clamp(index, 0, count)]
    }
}
