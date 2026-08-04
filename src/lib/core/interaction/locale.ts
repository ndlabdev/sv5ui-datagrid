import type { DataGridLocalePack } from '../types/index.js'

/**
 * Picking a language without being told which one.
 *
 * An app registers the packs it wants and the grid takes it from there: the
 * page's own language decides, the way it already decides date and number
 * formatting. Nothing is configured per string, and only the packs actually
 * imported reach the bundle — the grid cannot fetch a language it was never
 * given.
 */

/** What the page says it is written in, best source first. */
export function documentLocale(): string | undefined {
    if (typeof document !== 'undefined') {
        const declared = document.documentElement.lang?.trim()
        if (declared) return declared
    }
    if (typeof navigator !== 'undefined') return navigator.language
    return undefined
}

/**
 * How well a pack answers for a requested tag: 2 for the same tag, 1 for the
 * same language in another region, 0 for no relation.
 *
 * `vi` is answered by `vi-VN`, and `en-GB` by `en-US`, because a grid in
 * roughly the right language beats one in the wrong one.
 */
function matchScore(tag: string, wanted: string): number {
    const a = tag.toLowerCase()
    const b = wanted.toLowerCase()
    if (a === b) return 2
    return a.split('-')[0] === b.split('-')[0] ? 1 : 0
}

/**
 * The pack to use, or undefined to stay with the built-in English.
 *
 * `requested` wins when given; otherwise the page decides. A tag nobody
 * answers for falls through rather than throwing: a missing translation is
 * not a reason to refuse to render.
 */
export function resolveLocale(
    packs: DataGridLocalePack[],
    requested?: string
): DataGridLocalePack | undefined {
    if (packs.length === 0) return undefined

    const wanted = requested ?? documentLocale()
    if (!wanted) return undefined

    let best: DataGridLocalePack | undefined
    let bestScore = 0
    for (const pack of packs) {
        const score = matchScore(pack.tag, wanted)
        if (score > bestScore) {
            best = pack
            bestScore = score
        }
    }
    return best
}
