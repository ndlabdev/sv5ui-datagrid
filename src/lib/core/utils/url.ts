/** A `link` column turns row data into an `href`, so only schemes that
 * navigate are allowed through — `javascript:` and `data:` are not. */
const NAVIGABLE_PROTOCOLS = new Set(['http', 'https', 'mailto', 'tel', 'sms', 'ftp'])

/** A url is relative once one of these appears before any `:`. */
const PATH_START = /[/?#]/

/**
 * Returns the href to render, or `undefined` when it is not safe to navigate
 * to. Relative urls and fragments carry no scheme and are kept.
 *
 * The scheme is matched raw: a browser ignores control characters and
 * whitespace, so `java\tscript:` runs script — but it does not spell a name on
 * the list, so no cleanup pass is needed to reject it.
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
