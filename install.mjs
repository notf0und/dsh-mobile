#!/usr/bin/env node
/**
 * Install dsh-mobile into a DSH profile.
 *
 * A DSH profile is `$DSH_HOME/profiles/<name>`: a `package.json` carrying the
 * ordered bundle list (`dsh.profile.bundles`) and the out-of-tree plugin
 * dependencies, plus the `cordis.patch.yml` user layer. Installing a plugin is
 * therefore three edits and one install:
 *
 *   1. copy the plugin into `<profile>/plugins/dsh-mobile`;
 *   2. add the bundle to `dsh.profile.bundles`, after the surface bundle
 *      (`@deepseek-ai/dsh-web-app`) so its patch applies on top of the shell;
 *   3. add a `file:` dependency, then let pnpm materialize `node_modules`.
 *
 * The plugin lives inside the profile, so it survives
 * `npx @deepseek-ai/dsh@latest` upgrades — nothing here touches the installed
 * DSH package.
 *
 * Usage:
 *   node install.mjs [--profile web] [--home DIR] [--no-install] [--dry-run]
 *
 *   --home DIR      DSH home (default: $DSH_HOME, else ~/.dsh)
 *   --profile NAME  profile to install into (default: web)
 *   --no-install    copy files and edit package.json, but skip the install step
 *   --dry-run       report what would change and exit
 */
import { cpSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const PACKAGE = 'dsh-mobile'
const here = dirname(fileURLToPath(import.meta.url))
const source = here

const argv = process.argv.slice(2)
const flag = (name, fallback) => {
  const at = argv.indexOf(`--${name}`)
  return at === -1 ? fallback : argv[at + 1]
}
const has = (name) => argv.includes(`--${name}`)

const profileName = flag('profile', 'web')
const home = resolve(flag('home', process.env.DSH_HOME || join(homedir(), '.dsh')))
const dryRun = has('dry-run')
const skipInstall = has('no-install')

const profileDir = join(home, 'profiles', profileName)
const manifestPath = join(profileDir, 'package.json')
const vendorDir = join(profileDir, 'plugins', PACKAGE)

if (!existsSync(manifestPath)) {
  console.error(`no profile at ${profileDir}`)
  console.error(`start it once first, for example: dsh --profile ${profileName} --help`)
  process.exit(1)
}

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
manifest.dependencies ??= {}
manifest.dsh ??= {}
manifest.dsh.profile ??= {}
manifest.dsh.profile.bundles ??= ['@deepseek-ai/dsh-base']

const dependency = `file:./plugins/${PACKAGE}`
const bundles = manifest.dsh.profile.bundles
const changes = []

if (manifest.dependencies[PACKAGE] !== dependency) {
  manifest.dependencies[PACKAGE] = dependency
  changes.push(`dependencies.${PACKAGE} -> ${dependency}`)
}
{
  // Directly after the last shipped bundle, so this plugin's patch layer is
  // applied on top of the shell it decorates. Idempotent: an entry left in the
  // wrong position by an earlier install is moved rather than duplicated.
  const without = bundles.filter((name) => name !== PACKAGE)
  let at = without.length
  for (let i = without.length - 1; i >= 0; i -= 1) {
    if (without[i].startsWith('@deepseek-ai/')) {
      at = i + 1
      break
    }
  }
  const ordered = [...without.slice(0, at), PACKAGE, ...without.slice(at)]
  if (ordered.join('\u0000') !== bundles.join('\u0000')) {
    manifest.dsh.profile.bundles = ordered
    changes.push(`dsh.profile.bundles: ${PACKAGE} at index ${at}`)
  }
}

console.log(`profile:  ${profileDir}`)
console.log(`plugin:   ${source}`)
for (const change of changes) console.log(`  change: ${change}`)
if (changes.length === 0) console.log('  change: (none — already installed)')

if (dryRun) {
  console.log(`would vendor into ${vendorDir}`)
  process.exit(0)
}

// 1. vendor the plugin inside the profile (self-contained, survives upgrades)
mkdirSync(dirname(vendorDir), { recursive: true })
rmSync(vendorDir, { recursive: true, force: true })
cpSync(source, vendorDir, {
  recursive: true,
  filter: (path) => !path.includes(`${join(source, 'node_modules')}`) && !path.endsWith('/.DS_Store'),
})

// 2. rewrite the manifest atomically
const next = `${JSON.stringify(manifest, null, 2)}\n`
const temporary = `${manifestPath}.dsh-mobile.tmp`
writeFileSync(temporary, next)
renameSync(temporary, manifestPath)
console.log(`wrote ${manifestPath}`)

// 3. materialize node_modules
if (skipInstall) {
  console.log('skipped install (--no-install)')
} else {
  const result = spawnSync('pnpm', ['install', '--silent'], { cwd: profileDir, stdio: 'inherit' })
  if (result.error || result.status !== 0) {
    console.error(`\npnpm install failed (${result.error ? result.error.message : `exit ${result.status}`}).`)
    console.error('Retry with the dsh launcher, which forwards to the same directory:')
    console.error(`  dsh plugin --profile ${profileName} install`)
    process.exit(result.status ?? 1)
  }
}

// 4. pnpm skips re-linking a `file:` dependency whose manifest did not change,
//    which leaves a stale copy behind after an edit. The profile resolves the
//    bundle from node_modules, so make sure the copy there is this one.
const installed = join(profileDir, 'node_modules', PACKAGE)
const sameFile = (a, b) => {
  if (!existsSync(a) || !existsSync(b)) return false
  return readFileSync(a).equals(readFileSync(b))
}
if (existsSync(installed)) {
  const same =
    sameFile(join(installed, 'lib', 'client.js'), join(vendorDir, 'lib', 'client.js')) &&
    sameFile(join(installed, 'package.json'), join(vendorDir, 'package.json'))
  if (!same) {
    // A symlink resolves into the vendor dir already; a hoisted copy is
    // replaced wholesale.
    rmSync(installed, { recursive: true, force: true })
    cpSync(vendorDir, installed, { recursive: true })
    console.log(`refreshed ${installed}`)
  }
} else {
  cpSync(vendorDir, installed, { recursive: true })
  console.log(`created ${installed}`)
}

console.log(`
Installed. Restart the surface for the new browser roster to be composed:
  stop the running \`dsh web\` (or let the bridge idle it out) and reopen the GUI.
`)
