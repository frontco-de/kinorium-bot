import { spawnSync } from 'node:child_process'

const releaseArgs = process.argv.slice(2)
const supportedArgs = new Set(['--dry-run', '--first-release'])

function fail(message) {
  console.error(`Release aborted: ${message}`)
  process.exit(1)
}

function run(command, args, capture = false) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    stdio: capture ? ['ignore', 'pipe', 'inherit'] : 'inherit',
  })

  if (result.error) fail(result.error.message)
  if (result.status !== 0) process.exit(result.status ?? 1)

  return result.stdout?.trim() ?? ''
}

const unsupportedArg = releaseArgs.find(
  (argument) => !supportedArgs.has(argument)
)
if (unsupportedArg) fail(`unsupported argument ${unsupportedArg}`)

if (run('git', ['status', '--porcelain'], true)) {
  fail('commit or discard all working-tree changes first')
}

const branch = run('git', ['branch', '--show-current'], true)
if (branch !== 'main') fail('switch to main first')

const upstream = run(
  'git',
  ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}'],
  true
)
if (upstream !== 'origin/main') fail('main must track origin/main')

run('git', ['fetch', '--tags', 'origin'])

const [behind, ahead] = run(
  'git',
  ['rev-list', '--left-right', '--count', `${upstream}...HEAD`],
  true
)
  .split(/\s+/)
  .map(Number)

if (behind || ahead) {
  fail(`main must match origin/main (behind ${behind}, ahead ${ahead})`)
}

if (!releaseArgs.includes('--dry-run')) {
  run('yarn', ['validate'])
  if (run('git', ['status', '--porcelain'], true)) {
    fail('validation changed tracked files; review them before releasing')
  }
}

run('yarn', ['commit-and-tag-version', ...releaseArgs])
