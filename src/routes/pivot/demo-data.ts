import type { ColumnDef } from '$lib/index.js'

export interface Sale {
    id: number
    region: string
    quarter: string
    product: string
    size: string
    shipped: Date
    amount: number
    units: number
}

const MONTH: Record<string, number> = { Q1: 1, Q2: 4, Q3: 7, Q4: 10 }

const shippedIn = (quarter: string): Date => new Date(Date.UTC(2026, MONTH[quarter] ?? 0, 10))

interface Seed {
    region: string
    quarter: string
    product: string
    size: string
    amount: number
    units: number
}

const seeds: Seed[] = [
    { region: 'North', quarter: 'Q1', product: 'Widget', size: 'Small', amount: 100, units: 10 },
    { region: 'North', quarter: 'Q1', product: 'Gadget', size: 'Large', amount: 80, units: 4 },
    { region: 'North', quarter: 'Q2', product: 'Widget', size: 'Medium', amount: 150, units: 15 },
    { region: 'South', quarter: 'Q1', product: 'Widget', size: 'Small', amount: 200, units: 20 },
    { region: 'South', quarter: 'Q2', product: 'Gadget', size: 'Large', amount: 60, units: 3 },
    { region: 'South', quarter: 'Q2', product: 'Widget', size: 'Medium', amount: 40, units: 4 },
    { region: 'South', quarter: 'Q3', product: 'Widget', size: 'Small', amount: 120, units: 12 },
    { region: 'East', quarter: 'Q1', product: 'Gadget', size: 'Large', amount: 80, units: 4 },
    { region: 'East', quarter: 'Q2', product: 'Widget', size: 'Medium', amount: 120, units: 12 },
    { region: 'East', quarter: 'Q3', product: 'Gadget', size: 'Large', amount: 100, units: 5 }
]

const laterQuarter: Seed[] = [
    { region: 'North', quarter: 'Q4', product: 'Widget', size: 'Small', amount: 90, units: 9 },
    { region: 'South', quarter: 'Q4', product: 'Gadget', size: 'Large', amount: 40, units: 2 }
]

const build = (rows: Seed[]): Sale[] =>
    rows.map((seed, index) => ({ id: index + 1, ...seed, shipped: shippedIn(seed.quarter) }))

export const sales: Sale[] = build(seeds)

export const salesWithQ4: Sale[] = build([...seeds, ...laterQuarter])

export const columns: ColumnDef<Sale>[] = [
    { id: 'region', header: 'Vùng', width: 110, filter: 'text' },
    { id: 'quarter', header: 'Quý', width: 90, filter: 'text' },
    { id: 'product', header: 'Hàng', width: 110, filter: 'text' },
    { id: 'size', header: 'Cỡ', width: 100, filter: 'text' },
    { id: 'shipped', header: 'Ngày giao', type: 'date', width: 130 },
    { id: 'amount', header: 'Tiền', type: 'number', width: 100 },
    { id: 'units', header: 'Cái', type: 'number', width: 90 }
]

export const rowId = (sale: Sale): string => String(sale.id)
