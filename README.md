# dsh-mobile

A phone-first shell for the DeepSeek Harness Web UI. On a narrow viewport the
left navigation column stops being a grid track that squeezes the conversation
and becomes an off-canvas drawer, triggered from the conversation header — so a
phone gains **no vertical chrome at all**. Above the breakpoint nothing matches:
the desktop shell is the shipped one.

```
┌───────────────────────────────┐        ┌───────────────────────────────┐
│ Session title      ☰ ▣        │        │ Session title      ✕ ▣        │
├───────────────────────────────┤        ├───────────────┬───────────────┤
│                               │        │               │ ▓▓▓▓▓▓▓▓▓▓▓▓▓ │
│      conversation             │        │  conversation │ ▓ workspaces▓ │
│      (full width)             │        │   (still full │ ▓ sessions  ▓ │
│                               │        │    width)     │ ▓ settings  ▓ │
│                               │        │               │ ▓▓▓▓▓▓▓▓▓▓▓▓▓ │
└───────────────────────────────┘        └───────────────┴───────────────┘
            closed                                  open
        ☰ = this plugin's trigger, ▣ = the shipped right-panel control
```

## Why it exists

The shipped shell already has a narrow mode: below 1024px the sidebar
auto-collapses to a 56px rail, and toggling it re-expands the column *in the
grid*, which on a 390px phone leaves roughly 110px for the conversation. The
expand animates `grid-template-columns`, a track animation that re-solves the
whole frame on every frame — that is what makes the transition feel slow on a
phone, and the result covers almost the whole chat.

This plugin changes the *presentation*, not the navigation: the sidebar keeps
its full shipped content (workspaces, sessions, search, New Session, Settings)
and the shipped layout action still controls it, but on a phone it is positioned
over the conversation and slides in with a `transform`, which the compositor can
animate without re-laying-out the frame.

## What it does

**Phone shell (viewport ≤ 1023.98px — the shell's own narrow breakpoint):**

* the trigger is registered into `conversation.session.header.utilities` with
  the highest order, so it renders immediately to the left of the
  `conversation.session.header.corner` control that opens the right panel. React
  owns that placement; the plugin never injects nodes into a tree React manages;
* the sidebar column leaves the grid (`position: fixed`) and becomes a drawer
  capped at `min(86vw, 340px)`, over a scrim;
* the frame's left grid track is pinned to `0`, so the conversation always keeps
  the full viewport width;
* the frame's `grid-template-columns` transition is disabled and the shipped
  rail/wide entrance animations are suppressed — the only animation left is the
  drawer's `transform`;
* the sidebar drag handle (meaningless when the column is an overlay) is hidden;
* the right sidebar, already fullscreen below 768px, gets safe-area padding; and
* the drawer and scrim respect `env(safe-area-inset-*)`, and the plugin adds
  `viewport-fit=cover` to the viewport meta so those insets resolve in a
  standalone PWA.

**The blank-session fallback.** The conversation header hides its chrome while a
session is empty, and a brand-new session is exactly when you want to navigate
away. The registered button therefore unmounts there; the plugin detects that
and shows a small floating trigger in the top-left instead — which costs no
layout either. Both triggers drive the same action, and the drawer behaves
identically.

**Interaction:** a trigger toggles; the scrim, <kbd>Esc</kbd>, a left swipe on
the drawer, the shipped in-drawer collapse button, and picking a session / a
global panel / New Session / Settings all close it; a right swipe from the left
edge opens it.

**Settings opens full-screen, instead of inside the drawer.** The Settings
surface is a `position: fixed` modal that ships *inside* the sidebar's settings
seat. Inside the drawer that failed twice: the drawer's `transform` (and its
`will-change`) becomes the containing block for fixed positioning, so the modal
was laid out against the drawer's 335px box rather than the viewport; and the
drawer's click handler treated Settings as navigation, closed the drawer, and
slid the modal off-screen with it. Both are fixed: Settings is no longer in the
auto-close set, and while its overlay is mounted the drawer is promoted to a
full-viewport layer with the panel full-bleed.

**Enter is a line break, not a send.** A soft keyboard has no Shift+Enter, so
the shipped Enter-to-send turns every intended line break into an accidental
submission. On a phone the plugin stops the composer's plain-Enter keydown
before the submit handler sees it — and nothing else: no `preventDefault`, so
the editor's own `beforeinput` path inserts the paragraph break exactly as
Shift+Enter would. The send control is how you submit, and because modifier
combinations are deliberately let through, a hardware keyboard attached to the
phone can still send with Ctrl/Cmd+Enter. The media-query gate keeps desktop
byte-for-byte as shipped.

**Touch fixes (any viewport under the breakpoint):**

* the tool call "Inspect" pill is `opacity: 0` until `:hover` in the shipped
  CSS, which a touch screen never triggers — it is pinned visible here;
* tool card Input/Output blocks are compacted and terminal output is capped
  lower, because both are expensive vertical real estate on a phone;
* the trajectory toolbar is a single non-wrapping row (225px of fixed-width
  controls plus a shrinking search box) that overflows below ~345px; it is
  allowed to pan instead of clipping its search field; and
* **the `dsh-save-money` header widget keeps only its green/red status
  indicator** — the label collapses into a coloured dot and the account balance
  is dropped. See the caveat under Known limitations.

## Desktop is untouched

Every rule is gated on `body[data-dsh-mobile]`, an attribute the plugin sets
*only* while `matchMedia('(max-width: 1023.98px)')` matches, and removes on the
spot when it stops matching (rotation, resize, a desktop browser). With the
attribute absent, no rule in this plugin applies and the shipped grid tracks,
transitions, drag handles, hover behaviour and save-money badge are exactly as
delivered.

The live suite asserts this both by loading a desktop viewport and by resizing
an already-loaded phone page up to 1440px without a reload.

## Install

The plugin lives in the profile, not in the DSH installation, so it survives
`npx @deepseek-ai/dsh@latest` upgrades.

```sh
# from this directory (plugins/dsh-mobile)
node install.mjs                 # → $DSH_HOME/profiles/web
node install.mjs --profile tui   # a different profile
node install.mjs --dry-run       # show what would change
node install.mjs --home /path    # a non-default DSH home
```

The installer copies the plugin to `<profile>/plugins/dsh-mobile`, adds
`"dsh-mobile": "file:./plugins/dsh-mobile"` to the profile's dependencies and
`dsh-mobile` to `dsh.profile.bundles` (directly after the last shipped bundle,
so its patch applies on top of the shell), runs `pnpm install`, and verifies the
`node_modules` copy is current.

Any of those edits can be made by hand; the equivalent profile manifest is:

```json
{
  "dependencies": { "dsh-mobile": "file:./plugins/dsh-mobile" },
  "dsh": {
    "profile": {
      "bundles": [
        "@deepseek-ai/dsh-base",
        "@deepseek-ai/dsh-web-app",
        "dsh-mobile"
      ],
      "patchReload": "live"
    }
  }
}
```

**A restart is required** — the browser plugin roster (`window.__DSH_BOOT__`) is
composed once per boot. Stop the running `dsh web` and reopen the GUI; under the
`dsh-web-bridge` setup, letting it idle out and reopening `dsh.test` does it.

### Uninstall

Remove the `dsh-mobile` entry from `dsh.profile.bundles`, delete
`<profile>/plugins/dsh-mobile`, remove the dependency, run `pnpm install`, and
restart. Nothing outside the profile was touched.

## How it works

```
plugins/dsh-mobile
├── package.json          dual-face declaration: dsh.bundle.patch + dsh.client.platform
├── cordis.patch.yml      inserts the (inert) host row that puts the package on the browser roster
├── lib/index.mjs         host half — no host-side behaviour
├── lib/client.js         browser half — BUILT from src/client.js by scripts/build.mjs
├── src/client.js         the factory body: CSS text, the trigger component, the drawer controller
├── scripts/build.mjs      wraps the source in window.__ModuleLoader__.load({...})
└── install.mjs           profile installer
```

`@deepseek-ai/dsh-client-modules` scans the Loader tree for packages declaring
`dsh.client`, composes the browser boot graph, and serves
`/plugins/dsh-mobile/client.js`. That bundle registers a factory under the
package name; the kernel materialises it and adopts its `apply`/`inject` as a
Cordis plugin. There is no host-side work to do, so `lib/index.mjs` is empty —
it exists because a package only reaches the browser through a Loader row.

The browser half injects one `<style>`, one slot entry, and a small DOM
controller. It deliberately does **not** replace any slot: `sidebar` is a
`single` slot occupied by the shipped `SidebarRoot`, and registering there would
delete the workspaces, sessions and settings seats along with it. Instead:

1. `ctx.slots.register` contributes the trigger button into the header's
   utilities list — React renders it, so placement survives re-renders;
2. the button's mount/unmount is also the signal that a header exists
   (`hosted`), which the CSS gate `body[data-dsh-mobile-header-nav]` turns into
   "show the floating trigger instead";
3. a tiny external store carries the drawer's open state to that button, since
   the slot supplies no context and `ctx.layout` exposes no subscription;
4. the controller waits for the shipped frame (`[data-shell-overlay]`'s parent —
   two `querySelector` calls on a 750ms poll, which survives a replaced frame
   without observing the chat's token stream), tags the frame and its three
   columns with `data-dsh-mobile-*` attributes, and mirrors the shipped
   `data-sidebar-collapsed` attribute onto `body[data-dsh-mobile-drawer]`
   through a `MutationObserver`; and
5. the drawer is driven only through the public `ctx.layout.toggleSidebar()`
   action, so the shipped sidebar's own controls keep working and the plugin
   owns no navigation state of its own.

## Tuning

The stylesheet exposes its geometry as custom properties on
`body[data-dsh-mobile]`:

| Property | Default | Meaning |
|---|---|---|
| `--dsh-mobile-drawer-w` | `min(86vw, 340px)` | Drawer width |
| `--dsh-mobile-dur` | `240ms` (`0ms` under reduced motion) | Drawer/scrim transition |
| `--dsh-mobile-ease` | `cubic-bezier(.22,.61,.36,1)` | Drawer easing |
| `--dsh-mobile-scrim` | `rgba(0,0,0,.45)` | Scrim colour |

The breakpoint is the `MOBILE_QUERY` constant in `src/client.js`; it is
deliberately the same 1024px the shell uses, because that is the width below
which `ctx.layout.toggleSidebar()` flips its narrow-mode override. Change it and
run `node scripts/build.mjs`.

## Build

```sh
node scripts/build.mjs          # src/client.js -> lib/client.js
node scripts/build.mjs --check  # fail if lib/client.js is stale
```

`lib/client.js` is committed, so the plugin works from a checkout with no build
step. The build validates the factory body's syntax before writing.

## Verification

`dev/` (one directory up) holds the harness used to build this plugin. It boots
an **isolated** DSH home inside the workspace and points it at a **mock model**,
so a real workspace, a real session and a real assistant turn can be driven
without touching your profile or spending API budget.

```sh
cd ../../dev
./test.sh
```

118 checks across four suites, all passing:

| Suite | Checks | Covers |
|---|---|---|
| `dev/verify.mjs` | 61 | Real Chromium against real `dsh web`: hero → workspace picker → session → mock turn → header trigger; every open/close affordance (trigger, scrim, Esc, swipe, shipped collapse control); save-money compaction; live resize phone⇄desktop; tablet 900px; desktop 1440px; zero console errors |
| `dev/fixture.mjs` | 40 | The touch rules against the **shipped** CSS text and hashed class names, plus the slot registration (name/id/order) and the save-money widget rebuilt from its own inline styles: they apply at 320px and are inert at 1440px |
| `dev/check-settings.mjs` | 14 | Phone: Settings keeps the drawer open, the drawer goes full-viewport, the panel is full-screen and on-screen, and it returns to a capped drawer when closed. Desktop: the shipped 800px dialog and the 280px sidebar are untouched |
| `dev/check-enter.mjs` | 3 | Composer Enter behaviour with *trusted* key events: phone Enter inserts a line break, the send control still submits, desktop Enter still submits (and it reports that Ctrl+Enter still sends on a phone) |

Screenshots from the last run are in `dev/shots/`.

## Performance profiling

`dev/` also carries profilers, because "make it faster" needs a measurement
before a change. All of them run against the isolated instance at a chosen CPU
throttle, with the long mock reply streaming in:

| Tool | Answers |
|---|---|
| `dev/run-profiler.sh <script> [cpuRate]` | boots the isolated instance with the long mock reply and runs one profiler |
| `dev/profile-boot.mjs` | where cold start goes: milestones, the full combo URL and what is in it, per-request sizes |
| `dev/profile-mobile.mjs` | main-thread cost of boot, a streamed turn, and a drawer round trip, with long-task counts |
| `dev/profile-css.mjs` | A/B/A/B of this plugin's own `:has()` rules across identical streamed turns |
| `dev/boot-ab.sh` | boots the same flow with a plugin disabled, to price a roster change |

Headline numbers at 390px, CPU throttled 4x (roughly a mid-range phone):

* **Cold start is the whole story**: DOMContentLoaded ~200ms, then ~3.1-3.3s to
  the first frame. That is parse/execute of the shell bundle plus the client
  plugin roster, then the React mount.
* **The client roster ships as one combo script of ~4.3 MB transferred**, and
  `@deepseek-ai/dsh-client-ui-sidebar-documentpreview` is 3.1 MB of it (73%).
  Disabling that one row drops the combo to 1.18 MB.
* A streamed turn costs ~390ms of script, ~140ms of style and ~25ms of layout;
  the first turn after opening a session carries a one-off ~0.4-0.9s warm-up.
* A drawer open/close round trip is ~20ms of script, ~19ms of style, no long
  tasks - the `transform` drawer is not a source of jank.
* **This plugin's own CSS costs nothing measurable.** Stripping its `:has()`
  rules across identical turns moved style recalc by less than run-to-run noise
  (142ms with, 170ms without, mean of two passes).

## Known limitations

* **A restart is required after install** — the browser roster is composed once
  per boot, and DSH's client HMR only reloads bundles that a rebuild watcher
  rewrites.
* **The save-money rule matches inline styles.** That plugin has no class names,
  so the rule keys off its inline-style signature and needs the important flag
  to beat those inline declarations. If a future version changes the markup the
  rule stops matching and the widget renders as shipped — a visible regression
  rather than a broken layout, but one that needs a selector refresh.
* **Hashed class suffixes can drift.** The tool-call and trajectory extras use
  `[class*="_…"]` selectors; a future DSH that renames those classes degrades
  the extras. The phone shell itself uses only stable `data-*` attributes.
* **`viewport-fit=cover` is applied from the client.** It lands after the first
  paint, so a standalone PWA may need one reload before the safe-area insets
  take effect on the very first launch. An in-browser tab is unaffected.
* **The drawer is not focus-trapped.** Focus can move to the scrim; the scrim
  closes the drawer on click, and the sidebar is `visibility: hidden` while
  closed so it is not tabbable, but this is not a full modal focus trap.
* **The floating trigger is hidden while any modal is open** — dialogs use
  z-index 100+, the trigger uses 31. That is deliberate; it is not a bug.
