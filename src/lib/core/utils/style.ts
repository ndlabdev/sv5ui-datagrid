const PROPERTY = /^(--[a-zA-Z0-9-_]+|[a-zA-Z-]+)$/

/**
 * A `CellDecoration.style` record as one `style` attribute. A value is cut at
 * the first `;` so one entry stays one declaration: a feature reading a colour
 * out of row data cannot have that data open a second one.
 */
export function inlineStyle(style: Record<string, string> | undefined): string | undefined {
    if (!style) return undefined
    let result = ''
    for (const property in style) {
        if (!PROPERTY.test(property)) continue
        const value = style[property]
        if (value === undefined || value === null) continue
        const single = String(value).split(';')[0].trim()
        if (!single) continue
        result += `${property}:${single};`
    }
    return result || undefined
}
