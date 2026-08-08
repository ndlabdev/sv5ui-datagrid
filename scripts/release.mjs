#!/usr/bin/env node
/**
 * Cuts a release end to end:
 *
 *   npm run release -- minor        # or patch / major / an explicit 1.2.3
 *   npm run release -- minor --dry  # do everything except write, commit, push
 *
 * Bumps the version, closes the CHANGELOG's Unreleased section, runs the
 * gates, verifies the packed tarball, commits, tags, and pushes. Pushing the
 * tag is what publishes: `publish.yml` fires on `v*.*.*` and runs
 * `npm publish --provenance`. The script then waits for that workflow and
 * confirms the registry actually moved before reporting success.
 *
 * Resumable: if the version is already bumped and the CHANGELOG already has
 * its dated section — a previous run that stopped before tagging — it picks up
 * from there instead of refusing.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'

const args = process.argv.slice(2)
const dry = args.includes('--dry')
const bump = args.find((arg) => !arg.startsWith('-')) ?? 'patch'

const run = (cmd, argv, opts = {}) =>
    execFileSync(cmd, argv, { encoding: 'utf8', ...opts })
        ?.toString()
        .trim()
const step = (label) => console.log(`\n\x1b[1m${label}\x1b[0m`)
const fail = (message) => {
    console.error(`\n\x1b[31m${message}\x1b[0m\n`)
    process.exit(1)
}
const write = (file, content) => {
    if (!dry) writeFileSync(file, content)
}
const git = (...argv) => {
    if (dry) return console.log(`  [dry] git ${argv.join(' ')}`)
    return run('git', argv, { stdio: 'inherit' })
}

const pkg = () => JSON.parse(readFileSync('package.json', 'utf8'))
const current = pkg().version

function nextVersion() {
    if (/^\d+\.\d+\.\d+/.test(bump)) return bump
    const [major, minor, patch] = current.split('.').map(Number)
    // Pre-1.0: a breaking change is a minor, so `major` still means 1.0.0 only
    // when the user says so explicitly. `minor` is the usual release here.
    if (bump === 'major') return `${major + 1}.0.0`
    if (bump === 'minor') return `${major}.${minor + 1}.0`
    if (bump === 'patch') return `${major}.${minor}.${patch + 1}`
    return fail(`Unknown bump "${bump}". Use patch, minor, major, or an explicit X.Y.Z.`)
}

// ---------------------------------------------------------------- preflight

step('Preflight')

const branch = run('git', ['rev-parse', '--abbrev-ref', 'HEAD'])
if (branch !== 'main') fail(`On "${branch}". Releases are cut from main.`)

if (run('git', ['status', '--porcelain'])) {
    fail('Working tree is dirty. Commit or stash first.')
}

run('git', ['fetch', 'origin', '--quiet'])
if (run('git', ['rev-list', 'HEAD..origin/main', '--count']) !== '0') {
    fail('origin/main is ahead. Pull first.')
}

// The workflow cannot publish without this, and a tag that fails has to be
// deleted from the remote and the local repo before it can be retried.
const secrets = run('gh', ['secret', 'list']) ?? ''
if (!secrets.includes('NPM_TOKEN')) {
    fail(
        'NPM_TOKEN is not set on the repo, so publish.yml would build and then fail.\n' +
            'Set it first:  gh secret set NPM_TOKEN'
    )
}
console.log('  on main, clean, up to date, NPM_TOKEN present')

const version = nextVersion()
const tag = `v${version}`

if (run('git', ['tag', '-l', tag])) fail(`Tag ${tag} already exists.`)
if ((run('npm', ['view', pkg().name, 'versions', '--json']) ?? '').includes(`"${version}"`)) {
    fail(`${version} is already on npm. A published version cannot be replaced.`)
}

const changelogPath = 'CHANGELOG.md'
let changelog = readFileSync(changelogPath, 'utf8')
const released = new RegExp(
    `^## \\[${version.replace(/\./g, '\\.')}\\] - \\d{4}-\\d{2}-\\d{2}`,
    'm'
)
const resuming = current === version && released.test(changelog)

console.log(`  ${current} -> ${version}${resuming ? '  (resuming, already prepared)' : ''}`)
if (dry) console.log('  [dry] nothing will be written or pushed')

// ------------------------------------------------------------------- gates

step('Gates')
for (const script of ['lint', 'check', 'test']) {
    run('npm', ['run', script], { stdio: 'inherit' })
}

// ------------------------------------------------------------------ prepare

if (!resuming) {
    step('Prepare')

    if (!/^## \[Unreleased\]/m.test(changelog)) {
        fail('CHANGELOG has no [Unreleased] section, so there is nothing to release.')
    }

    const today = new Date().toISOString().slice(0, 10)
    changelog = changelog.replace(/^## \[Unreleased\]/m, `## [${version}] - ${today}`)

    // Link references live in a block at the bottom, newest first.
    const url = `https://github.com/ndlabdev/sv5ui-datagrid/releases/tag/${tag}`
    changelog = /^\[\d+\.\d+\.\d+\]:/m.test(changelog)
        ? changelog.replace(/^(\[\d+\.\d+\.\d+\]:)/m, `[${version}]: ${url}\n$1`)
        : `${changelog.trimEnd()}\n\n[${version}]: ${url}\n`

    write(changelogPath, changelog)
    if (!dry) run('npm', ['version', version, '--no-git-tag-version'], { stdio: 'inherit' })
    console.log(`  package.json -> ${version}, CHANGELOG section dated ${today}`)
}

// ------------------------------------------------------------------- verify

step('Verify the packed tarball')
if (dry && !resuming) {
    console.log('  [dry] skipped: the bump was not written, so the tarball would be stale')
} else {
    run('node', ['scripts/verify-package.mjs'], { stdio: 'inherit' })
}

// -------------------------------------------------------------------- ship

step('Commit, tag, push')
if (!resuming) {
    git('add', 'package.json', changelogPath)
    git('commit', '-m', `chore(release): ${version}`)
}
git('tag', tag)
git('push', 'origin', 'main')
git('push', 'origin', 'main:dev')
git('push', 'origin', tag)

if (dry) {
    console.log('\n[dry] stopping before the publish watch.\n')
    process.exit(0)
}

// ------------------------------------------------------------------ publish

step(`Publishing — waiting for publish.yml on ${tag}`)
console.log('  (the tag push is what triggers it)')

let runId = ''
for (let attempt = 0; attempt < 20 && !runId; attempt++) {
    execFileSync('sleep', ['3'])
    runId = run('gh', [
        'run',
        'list',
        '--workflow',
        'publish.yml',
        '--branch',
        tag,
        '--limit',
        '1',
        '--json',
        'databaseId',
        '--jq',
        '.[0].databaseId // ""'
    ])
}
if (!runId) fail(`publish.yml did not start for ${tag}. Check: gh run list --workflow publish.yml`)

try {
    run('gh', ['run', 'watch', runId, '--exit-status'], { stdio: 'inherit' })
} catch {
    fail(
        `publish.yml failed. ${version} was not published.\n` +
            'Fix the cause, then delete and re-push the tag:\n' +
            `  git push --delete origin ${tag} && git tag -d ${tag}`
    )
}

// A green workflow is not proof the registry moved.
step('Confirming the registry')
let published = ''
for (let attempt = 0; attempt < 10 && published !== version; attempt++) {
    execFileSync('sleep', ['5'])
    published = run('npm', ['view', pkg().name, 'version']) ?? ''
}
if (published !== version) {
    fail(`Workflow was green but npm still reports ${published || 'nothing'}. Check manually.`)
}
console.log(`  npm reports ${published}`)

step('Release notes')
try {
    run('gh', ['release', 'create', tag, '--title', tag, '--notes-from-tag'], { stdio: 'inherit' })
} catch {
    console.log(`  could not create the GitHub release; do it by hand: gh release create ${tag}`)
}

console.log(`\n\x1b[32m${pkg().name}@${version} published.\x1b[0m\n`)
console.log('Consumers install a tarball, not the registry. To update the Pro repo:')
console.log('  cd ../sv5ui-datagrid-pro && pnpm sync:community')
console.log(`  then point devDependencies at vendor/sv5ui-datagrid-${version}.tgz\n`)
