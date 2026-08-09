/**
 * Picks the form of a counted phrase, per the language's own rules.
 *
 * `Intl.PluralRules` rather than `count === 1`: French and Portuguese read zero
 * as singular and Russian needs three forms. The whole phrase is the form, not
 * the noun — Spanish, French and Portuguese inflect the participle with it
 * ("1 fila seleccionada" against "2 filas seleccionadas").
 */
export function plural(
    tag: string,
    forms: { other: string } & Partial<Record<Intl.LDMLPluralRule, string>>
): (count: number) => string {
    const rules = new Intl.PluralRules(tag)
    return (count) => forms[rules.select(count)] ?? forms.other
}
