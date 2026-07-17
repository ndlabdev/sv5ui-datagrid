#!/usr/bin/env node
import { chromium } from 'playwright'

const url = process.argv[2] ?? 'http://localhost:5173/virtual'
const seconds = Number(process.argv[3] ?? 2)

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
const errors = []
page.on('pageerror', (err) => errors.push(String(err)))

await page.goto(url, { waitUntil: 'networkidle' })
await page.waitForTimeout(1500)

const domRows = () =>
    page.evaluate(
        () => document.querySelectorAll('[role="rowgroup"]:last-child [role="row"]').length
    )
const domCells = () => page.evaluate(() => document.querySelectorAll('[role="gridcell"]').length)

console.log(`rows in DOM: ${await domRows()} · cells in DOM: ${await domCells()}`)

const vertical = await page.evaluate(async (duration) => {
    const el = document.querySelector('[role="grid"]')
    el.scrollTop = 0
    const start = performance.now()
    let frames = 0
    return await new Promise((resolve) => {
        function tick() {
            frames += 1
            el.scrollTop += 400
            if (performance.now() - start < duration) requestAnimationFrame(tick)
            else resolve(frames)
        }
        requestAnimationFrame(tick)
    })
}, seconds * 1000)
console.log(
    `vertical scroll: ${vertical} frames in ${seconds}s (~${Math.round(vertical / seconds)} fps)`
)

const horizontal = await page.evaluate(async (duration) => {
    const el = document.querySelector('[role="grid"]')
    el.scrollLeft = 0
    const start = performance.now()
    let frames = 0
    return await new Promise((resolve) => {
        function tick() {
            frames += 1
            el.scrollLeft = (el.scrollLeft + 120) % Math.max(1, el.scrollWidth - el.clientWidth)
            if (performance.now() - start < duration) requestAnimationFrame(tick)
            else resolve(frames)
        }
        requestAnimationFrame(tick)
    })
}, seconds * 1000)
console.log(
    `horizontal scroll: ${horizontal} frames in ${seconds}s (~${Math.round(horizontal / seconds)} fps)`
)

console.log(`rows in DOM after scroll: ${await domRows()} · cells: ${await domCells()}`)
console.log('page errors:', errors.length ? errors : 'none')
await browser.close()
