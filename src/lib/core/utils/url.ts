/**
 * A `link` column turns row data into an `href`, so a value the grid never
 * authored decides what a click executes. Only schemes that navigate are
 * allowed through; `javascript:`, `data:` and `vbscript:` are dropped so a
 * hostile row cannot run script in the host page.
 */
const NAVIGABLE_PROTOCOLS = new Set(['http', 'https', 'mailto', 'tel', 'sms', 'ftp'])

/** A url is relative once one of these appears before any `:`. */
const PATH_START = /[/?#]/

/**
 * Returns the href to render, or `undefined` when the value is not safe to
 * navigate to. Relative urls and fragments carry no scheme and are kept.
 *
 * The scheme is matched raw against the allowlist rather than being cleaned
 * up first. A browser ignores control characters and whitespace when it
 * resolves a url, so `java\tscript:` and `java script:` both run script — but
 * neither spells a name on the list, so both are rejected without the grid
 * having to enumerate every character a browser might drop.
 */
export function safeHref(value: unknown): string | undefined {
    if (value === null || value === undefined) return undefined

    const href = String(value).trim()
    if (href === '') return undefined

    const colon = href.indexOf(':')
    const pathStart = href.search(PATH_START)
    const relative = colon < 0 || (pathStart >= 0 && pathStart < colon)
    if (relative) return href

    return NAVIGABLE_PROTOCOLS.has(href.slice(0, colon).toLowerCase()) ? href : undefined
}
