export function plural(
    tag: string,
    forms: { other: string } & Partial<Record<Intl.LDMLPluralRule, string>>
): (count: number) => string {
    const rules = new Intl.PluralRules(tag)
    return (count) => forms[rules.select(count)] ?? forms.other
}
