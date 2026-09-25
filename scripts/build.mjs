/**
 * Wrap `src/client.js` in the `window.__ModuleLoader__.load({ id, factory })`
 * envelope the DSH browser kernel constructs, and write `lib/client.js`.
 *
 * The client module system executes a bundle only to REGISTER its factory; the
 * body runs on first import. Every bundle registers itself under its **package
 * name**, which is what the modules node half matches against the boot graph,
 * so the id here is read from package.json rather than hard-coded.
 *
 * Usage: node scripts/build.mjs [--check]
 *   --check  fail if lib/client.js is not exactly what the source builds
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const source = readFileSync(join(root, 'src', 'client.js'), 'utf8')

// Fail loudly on a syntax error here rather than inside the browser kernel.
// `require`/`module`/`exports` are the CJS-shaped names the factory receives.
try {
  // eslint-disable-next-line no-new-func -- deliberate syntax gate
  new Function('require', 'module', 'exports', source)
} catch (error) {
  console.error(`src/client.js is not valid factory body source:\n${error.message}`)
  process.exit(1)
}

const indent = (text) => text.replace(/\n(?=.)/g, '\n\t\t').replace(/\n$/, '')

const bundle = `window.__ModuleLoader__.load({
	id: ${JSON.stringify(pkg.name)},
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;

${indent(source)}

		return module.exports;
	}
});
`

const target = join(root, 'lib', 'client.js')
if (process.argv.includes('--check')) {
  const current = existsSync(target) ? readFileSync(target, 'utf8') : ''
  if (current !== bundle) {
    console.error('lib/client.js is stale — run `node scripts/build.mjs`')
    process.exit(1)
  }
  console.log('lib/client.js is up to date')
} else {
  writeFileSync(target, bundle)
  console.log(`wrote lib/client.js (${bundle.length} bytes)`)
}
