import type { DataGridLocalePack } from '../types/index.js'

/**
 * Picking a language without being told which one: an app registers the packs
 * it wants and the page's own language decides.
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
 * 2 for the same tag, 1 for the same language elsewhere, 0 for no relation:
 * roughly the right language beats the wrong one.
 */
function matchScore(tag: string, wanted: string): number {
    const a = tag.toLowerCase()
    const b = wanted.toLowerCase()
    if (a === b) return 2
    return a.split('-')[0] === b.split('-')[0] ? 1 : 0
}

/**
 * The pack to use, or undefined for the built-in English. A tag nobody
 * answers for falls through rather than throwing.
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
