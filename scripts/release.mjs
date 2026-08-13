#!/usr/bin/env node
/**
 * Cuts a release end to end:
 *
 *   npm run release -- minor        # or patch / major / an explicit 1.2.3
 *   npm run release -- minor --dry  # do everything except write, commit, push
 *
 * Bumps the version, closes the CHANGELOG's Unreleased section, runs the
 * gates, verifies the packed tarball, and commits. `main` is protected and
 * takes no direct push, so the commit goes up as a `release/vX.Y.Z` branch and
 * through a pull request the script waits on and merges. Only then is the tag
 * cut, and pushing the tag is what publishes: `publish.yml` fires on `v*.*.*`
 * and runs `npm publish --provenance`. The script then waits for that workflow
 * and confirms the registry actually moved before reporting success.
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

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Polls until GitHub has attached at least one check to the pull request.
 * `gh pr checks` exits non-zero both when a check has failed and when none
 * exists yet, so the two have to be told apart by asking for the list rather
 * than by the exit code. Returns false if none ever arrives.
 */
async function waitForChecksToAppear(prNumber, attempts = 18, intervalMs = 10_000) {
    for (let attempt = 0; attempt < attempts; attempt++) {
        try {
            // stderr is swallowed on purpose: while no check exists yet, `gh`
            // writes "no checks reported on the ... branch" there, and
            // execFileSync forwards that to our terminal. Letting it through
            // would print the exact alarming line this loop exists to stop
            // people believing — once per attempt.
            const buckets = JSON.parse(
                run('gh', ['pr', 'checks', prNumber, '--json', 'bucket'], {
                    stdio: ['ignore', 'pipe', 'ignore']
                }) || '[]'
            )
            if (buckets.length > 0) return true
        } catch {
            // No checks reported yet, which is the case this loop exists for.
        }
        if (attempt === 0) console.log('  no check attached yet, waiting for one to appear')
        await sleep(intervalMs)
    }
    return false
}

const pkg = () => JSON.parse(readFileSync('package.json', 'utf8'))
const current = pkg().version

function nextVersion() {
    if (/^\d+\.\d+\.\d+/.test(bump)) return bump
    const [major, minor, patch] = current.split('.').map(Number)
    // Past 1.0 since 2026-08-10, so plain semver applies: a breaking change is
    // a major. The pre-1.0 rule that folded breaking into a minor is gone.
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

// Work lands on `dev`; `main` only moves at release time. Releasing while it
// is behind ships the previous version's code under a new number, with a
// CHANGELOG describing changes the tarball does not contain — and every other
// check here would pass. On 2026-08-13 main was 23 commits behind.
//
// `rev-list` exits 128 rather than returning a count when the ref is missing,
// which a single-branch clone would hit, so that has to read as "cannot tell"
// instead of taking down the release with a stack trace.
let unreleased
try {
    unreleased = run('git', ['rev-list', 'origin/main..origin/dev', '--count'], {
        stdio: ['ignore', 'pipe', 'ignore']
    })
} catch {
    fail(
        'Cannot compare main with origin/dev — the ref is missing.\n' +
            'Releases ship what is on dev, so this has to be checkable:  git fetch origin dev'
    )
}
if (unreleased !== '0') {
    fail(
        `origin/dev is ${unreleased} commits ahead of main, so this would ship without them.\n` +
            'Land them first, and merge any open PR that belongs in the release before you do:\n' +
            '  gh pr create --base main --head dev --title "chore: bring main level with dev"'
    )
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
console.log('  on main, clean, level with dev, NPM_TOKEN present')

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

/**
 * `main` is protected: it takes no direct push, from an admin either, and the
 * `ci` check has to be green. So the release commit goes up as a branch, opens
 * a pull request, waits for that check and merges — and only then is the tag
 * cut, from the merge commit `main` ends on. Tags are outside branch
 * protection, and pushing one is still what publishes.
 */
step('Commit, open the release PR, merge it')
const releaseBranch = `release/${tag}`

if (!resuming) {
    git('add', 'package.json', changelogPath)
    git('commit', '-m', `chore(release): ${version}`)
}

if (dry) {
    console.log(`  [dry] git push origin HEAD:refs/heads/${releaseBranch}`)
    console.log(`  [dry] gh pr create --base main --head ${releaseBranch}`)
    console.log('  [dry] wait for the ci check, then gh pr merge --merge')
    console.log('  [dry] git checkout main && git pull, then tag the merge commit')
    console.log(`  [dry] git tag ${tag} && git push origin ${tag}`)
    console.log('  [dry] git push origin main:dev')
    console.log('\n[dry] stopping before the publish watch.\n')
    process.exit(0)
}

git('push', 'origin', `HEAD:refs/heads/${releaseBranch}`)

const existingPr = run('gh', [
    'pr',
    'list',
    '--head',
    releaseBranch,
    '--json',
    'number',
    '--jq',
    '.[0].number // ""'
])
const prNumber =
    existingPr ||
    run('gh', [
        'pr',
        'create',
        '--base',
        'main',
        '--head',
        releaseBranch,
        '--title',
        `chore(release): ${version}`,
        '--body',
        `Cut by \`npm run release\`. The tag is pushed from \`main\` once this merges, and that is what publishes ${version}.`,
        '--assignee',
        '@me'
    ])?.match(/\/pull\/(\d+)/)?.[1]

if (!prNumber) fail('Could not open or find the release pull request.')
console.log(`  release PR #${prNumber} on ${releaseBranch}`)

step(`Waiting for the ci check on #${prNumber}`)

// `gh pr checks --watch` does not wait for a check to exist. A PR opened a
// second ago has none attached yet, and it exits non-zero saying so — which
// read as a failure and aborted an otherwise healthy 1.1.0. Wait for the run
// to appear first, then hand over to --watch for the run itself.
if (!(await waitForChecksToAppear(prNumber))) {
    fail(
        `No check ever appeared on #${prNumber}. Nothing is tagged or published.\n` +
            'ci.yml runs on pull requests to main — check that it is enabled, then run the same command again.'
    )
}

try {
    run('gh', ['pr', 'checks', prNumber, '--watch', '--interval', '20'], { stdio: 'inherit' })
} catch {
    fail(
        'CI failed on the release PR. Nothing is tagged or published.\n' +
            `Look at it with:  gh pr checks ${prNumber}\n` +
            `If it is genuinely red, fix it on ${releaseBranch} and run the same command again.`
    )
}

step('Merging the release PR')
run('gh', ['pr', 'merge', prNumber, '--merge', '--delete-branch'], { stdio: 'inherit' })

git('checkout', 'main')
git('pull', '--ff-only', 'origin', 'main')

const merged = run('git', ['show', 'HEAD:package.json'])
if (!merged?.includes(`"version": "${version}"`)) {
    fail(`main is not carrying ${version} after the merge. Check the pull request.`)
}

step('Tag and push')
git('tag', tag)
git('push', 'origin', tag)
// The mirror is unprotected, so it takes the merge commit directly.
git('push', 'origin', 'main:dev')

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
