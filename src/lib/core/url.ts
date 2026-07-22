/**
 * A `link` column turns row data into an `href`, so a value the grid never
 * authored decides what a click executes. Only schemes that navigate are
 * allowed through; `javascript:`, `data:` and `vbscript:` are dropped so a
 * hostile row cannot run script in the host page.
 */
const NAVIGABLE_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'tel:', 'sms:', 'ftp:'])

const SCHEME = /^[a-zA-Z][a-zA-Z0-9+.-]*:/

/**
 * Whitespace and control characters a browser drops before resolving a url.
 * Matching them is the point here — they are exactly what hides a scheme.
 */
// eslint-disable-next-line no-control-regex
const IGNORED = /[\u0000-\u0020\u00a0\ufeff]/g

/**
 * Returns the href to render, or `undefined` when the value is not safe to
 * navigate to. Relative urls and fragments carry no scheme and are kept.
 */
export function safeHref(value: unknown): string | undefined {
    if (value === null || value === undefined) return undefined

    const href = String(value).trim()
    if (href === '') return undefined

    // The scheme has to be read from a stripped copy, because a browser reads
    // `java\tscript:` and `java script:` as `javascript:`.
    const scheme = SCHEME.exec(href.replace(IGNORED, ''))
    if (!scheme) return href

    return NAVIGABLE_PROTOCOLS.has(scheme[0].toLowerCase()) ? href : undefined
}
