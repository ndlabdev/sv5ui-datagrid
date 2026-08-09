/**
 * Picks the form of a counted phrase, per the language's own rules.
 *
 * `Intl.PluralRules` rather than `count === 1`, because the split is not the
 * same everywhere: French and Portuguese read zero as singular, Russian needs
 * three forms, and the languages with no grammatical number never call this.
 * A form the language does not use falls back to `other`, so a pack only
 * declares the ones it needs.
 *
 * The whole phrase is the form, not just the noun — Spanish, French and
 * Portuguese inflect the participle with it ("1 fila seleccionada" against
 * "2 filas seleccionadas"), and pluralising the noun alone would leave the
 * agreement broken in a way that is harder to see than the noun itself.
 */
export function plural(
    tag: string,
    forms: { other: string } & Partial<Record<Intl.LDMLPluralRule, string>>
): (count: number) => string {
    const rules = new Intl.PluralRules(tag)
    return (count) => forms[rules.select(count)] ?? forms.other
}
