window.__ModuleLoader__.load({
	id: "dsh-mobile",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;

/**
		 * dsh-mobile — a phone-first shell for the DeepSeek Harness Web UI.
		 *
		 * What it changes
		 * ---------------
		 * On viewports the shell itself treats as narrow (the same 1024px breakpoint
		 * that already switches the sidebar into its `narrowExpanded` mode) the left
		 * column stops being a grid track that squeezes the conversation and becomes an
		 * off-canvas drawer. Nothing is added to the top of the app: the trigger lives
		 * in the conversation header, beside the right-panel control that is already
		 * there, so the phone gains no vertical chrome at all.
		 *
		 *   · the drawer is a `min(86vw, 340px)` overlay that slides in over the
		 *     conversation with a scrim, instead of animating `grid-template-columns` —
		 *     that track animation was the slow part, and it re-laid-out the whole
		 *     frame on every frame;
		 *   · the frame's left track is pinned to `0`, so the conversation always keeps
		 *     the full viewport width;
		 *   · the shipped rail/wide entrance animations are suppressed, leaving the
		 *     drawer's `transform` as the only animation;
		 *   · the sidebar drag handle (meaningless for an overlay) is hidden;
		 *   · the right sidebar, already fullscreen below 768px, gets safe-area
		 *     padding; and
		 *   · the drawer and scrim respect `env(safe-area-inset-*)`, and the plugin adds
		 *     `viewport-fit=cover` to the viewport meta so those insets resolve in a
		 *     standalone PWA.
		 *
		 * Where the trigger lives
		 * -----------------------
		 * `conversation.session.header.utilities` is a list slot, so this package
		 * registers a button into it with the highest order — directly to the left of
		 * the `conversation.session.header.corner` control that opens the right panel.
		 * React owns that placement, so it survives re-renders; the plugin never
		 * injects nodes into a tree React manages.
		 *
		 * That header only exists once the session has something in it (a blank session
		 * hides its chrome), so the plugin also owns a small floating trigger, shown
		 * only while the header's button is absent. Either trigger drives the same
		 * action, and the drawer behaves identically in both cases.
		 *
		 * Interaction: a trigger toggles; the scrim, Escape, a left swipe on the
		 * drawer, the shipped in-drawer collapse button, and picking a session / a
		 * global panel / New Session / Settings all close it; a right swipe from the
		 * left edge opens it. The shipped sidebar's own controls keep working because
		 * the plugin drives the public `ctx.layout.toggleSidebar()` action and owns no
		 * navigation state.
		 *
		 * Other mobile adaptations
		 * ------------------------
		 * A few shipped affordances assume a mouse:
		 *
		 *   · the tool-call "Inspect" pill is `opacity: 0` until `:hover` — pinned
		 *     visible here, because a touch screen never enters hover;
		 *   · Input/Output blocks and terminal output are compacted, and the
		 *     single-row trajectory toolbar is allowed to pan instead of clipping its
		 *     search field on a small phone; and
		 *   · the `dsh-save-money` header widget keeps only its green/red status
		 *     indicator: its label text collapses into a dot and the account balance is
		 *     dropped. That plugin renders with inline styles rather than classes, so
		 *     these rules match on its inline-style signature; if a future version
		 *     changes it the rules simply stop matching and the widget renders as
		 *     shipped.
		 *
		 * Above the breakpoint nothing matches: every rule is gated on
		 * `body[data-dsh-mobile]`, which this plugin only sets while the media query is
		 * true. The desktop shell is byte-for-byte the shipped one.
		 *
		 * This file is the factory body only: `scripts/build.mjs` wraps it in the
		 * `window.__ModuleLoader__.load({ id, factory })` envelope the client kernel
		 * expects and writes `lib/client.js`.
		 */

		/**
		 * The narrow breakpoint. Matches `SIDEBAR_AUTO_COLLAPSE` in
		 * `@deepseek-ai/dsh-client-ui-layout`; below it `ctx.layout.toggleSidebar()`
		 * flips the sidebar's `narrowExpanded` override instead of its width.
		 */
		const MOBILE_QUERY = '(max-width: 1023.98px)'

		/** Marker attributes this plugin owns (never set by the shipped shell). */
		const ATTR_MOBILE = 'data-dsh-mobile'
		const ATTR_HEADER_NAV = 'data-dsh-mobile-header-nav'
		const ATTR_FRAME = 'data-dsh-mobile-frame'
		const ATTR_SIDEBAR = 'data-dsh-mobile-sidebar'
		const ATTR_CENTER = 'data-dsh-mobile-center'
		const ATTR_RIGHTBAR = 'data-dsh-mobile-rightbar'
		const ATTR_DRAWER = 'data-dsh-mobile-drawer'

		/** Stylesheet id, so a re-apply never stacks duplicate rules. */
		const STYLE_ID = 'dsh-mobile/styles'

		/** Id lent to the shipped sidebar column so a trigger can point at it. */
		const DRAWER_ID = 'dsh-mobile-drawer'

		/** Class on the header trigger, and on the floating fallback. */
		const NAV_CLASS = 'dsh-mobile-nav'
		const FAB_CLASS = 'dsh-mobile-fab'

		/** The composer: a Lexical contenteditable, and the only one on the page. */
		const COMPOSER_SELECTOR = '[contenteditable="true"]'

		/** The header list slot the trigger is registered into. */
		const NAV_SLOT = 'conversation.session.header.utilities'

		/**
		 * Stable hook on the Settings dialog. Since DSH 0.1.7 the settings surface is a
		 * `createPortal(…, document.body)` modal, so it is no longer a descendant of the
		 * sidebar's settings seat; this attribute is the one part of its markup that is
		 * not a hashed CSS-module class.
		 */
		const SETTINGS_DIALOG = '[data-shortcut-modal="settings"]'

		const CSS = `
		/* ---------------------------------------------------------------- tokens -- */
		body[${ATTR_MOBILE}] {
		  --dsh-mobile-drawer-w: min(86vw, 340px);
		  --dsh-mobile-ease: cubic-bezier(.22, .61, .36, 1);
		  --dsh-mobile-dur: 240ms;
		  --dsh-mobile-scrim: rgba(0, 0, 0, .45);
		  -webkit-tap-highlight-color: transparent;
		}
		@media (prefers-reduced-motion: reduce) {
		  body[${ATTR_MOBILE}] { --dsh-mobile-dur: 0ms; }
		}

		/* ---------------------------------------------------------- the trigger --- */
		/* Registered into the conversation header's utilities list, so it sits beside
		   the corner control that opens the right panel. Hidden above the breakpoint. */
		.dsh-mobile-nav { display: none; }
		body[${ATTR_MOBILE}] .dsh-mobile-nav {
		  flex: none;
		  display: inline-flex;
		  align-items: center;
		  justify-content: center;
		  width: 28px;
		  height: 28px;
		  padding: 6px;
		  color: var(--dsw-alias-label-secondary);
		  cursor: pointer;
		  background: none;
		  border: 0;
		  border-radius: 28px;
		}
		body[${ATTR_MOBILE}] .dsh-mobile-nav:hover {
		  color: var(--dsw-alias-label-primary);
		  background: var(--dsw-alias-interactive-bg-hover);
		}
		body[${ATTR_MOBILE}] .dsh-mobile-nav:focus-visible {
		  outline: 2px solid var(--dsw-alias-state-business-primary);
		  outline-offset: -2px;
		}
		body[${ATTR_MOBILE}] .dsh-mobile-nav svg { width: 15px; height: 15px; }

		/* The fallback trigger, for the blank-session screen where the header (and so
		   the registered button) is not rendered. It floats, so it costs no layout. */
		.dsh-mobile-fab { display: none; }
		body[${ATTR_MOBILE}]:not([${ATTR_HEADER_NAV}]) .dsh-mobile-fab {
		  position: fixed;
		  top: calc(env(safe-area-inset-top, 0px) + 6px);
		  left: calc(env(safe-area-inset-left, 0px) + 6px);
		  z-index: 31;
		  display: inline-flex;
		  align-items: center;
		  justify-content: center;
		  width: 36px;
		  height: 36px;
		  padding: 0;
		  color: var(--dsw-alias-label-secondary);
		  cursor: pointer;
		  background: var(--dsw-specific-sidebar-fill, var(--dsw-alias-bg-base));
		  border: .5px solid var(--dsw-alias-border-l3);
		  border-radius: 10px;
		}
		body[${ATTR_MOBILE}]:not([${ATTR_HEADER_NAV}]) .dsh-mobile-fab:active {
		  background: var(--dsw-alias-interactive-bg-hover);
		}
		body[${ATTR_MOBILE}]:not([${ATTR_HEADER_NAV}]) .dsh-mobile-fab svg { width: 18px; height: 18px; }

		/* ---------------------------------------------------------- the drawer ---- */
		/* The frame keeps its shipped grid, minus the left track: the drawer is
		   positioned, so reserving a track for it would only squeeze the conversation
		   (and animating that track is what made the expand feel slow). Because the
		   drawer leaves the flow, the remaining columns have to be placed explicitly —
		   otherwise the centre auto-places into the zero-width first track. */
		body[${ATTR_MOBILE}] [${ATTR_FRAME}] {
		  grid-template-columns: 0 minmax(0, 1fr) 0 !important;
		  transition: none !important;
		}
		body[${ATTR_MOBILE}] [${ATTR_CENTER}] { grid-column: 2; }
		body[${ATTR_MOBILE}] [${ATTR_RIGHTBAR}] { grid-column: 3; }

		body[${ATTR_MOBILE}] [${ATTR_SIDEBAR}] {
		  position: fixed;
		  top: 0;
		  bottom: 0;
		  left: 0;
		  z-index: 29;
		  box-sizing: border-box;
		  width: var(--dsh-mobile-drawer-w);
		  max-width: 100%;
		  padding-top: env(safe-area-inset-top, 0px);
		  padding-bottom: env(safe-area-inset-bottom, 0px);
		  border-right: .5px solid var(--dsw-alias-border-l3);
		  box-shadow: 0 12px 40px rgba(0, 0, 0, .28);
		  visibility: hidden;
		  transform: translate3d(-102%, 0, 0);
		  will-change: transform;
		  overscroll-behavior: contain;
		  transition:
		    transform var(--dsh-mobile-dur) var(--dsh-mobile-ease),
		    visibility 0s linear var(--dsh-mobile-dur);
		}
		body[${ATTR_MOBILE}][${ATTR_DRAWER}="open"] [${ATTR_SIDEBAR}] {
		  visibility: visible;
		  transform: translate3d(0, 0, 0);
		  transition: transform var(--dsh-mobile-dur) var(--dsh-mobile-ease);
		}
		/* The shipped entrance animations re-run on the rail ⇄ expanded swap; on a
		   phone they add work to the one transition we are trying to make smooth. */
		body[${ATTR_MOBILE}] [${ATTR_SIDEBAR}] [class*="_wide"],
		body[${ATTR_MOBILE}] [${ATTR_SIDEBAR}] [class*="_railIn"] * { animation: none !important; }

		/* A resize handle for a column that is now an overlay is only a touch trap. */
		body[${ATTR_MOBILE}] [data-side="sidebar"] { display: none !important; }

		/* The shipped sidebar sizes its expanded root from the layout's own column width,
		   applied as an inline style (SidebarRoot's width prop, 280px by default when
		   the column is untouched). That is narrower than this drawer, so the root
		   rendered as a 280px column inside a 335px drawer: a strip of empty sidebar to
		   the right of the logo and the workspace list, with the list's scrollbar
		   stranded in the middle of it. Let the root fill the drawer. */
		body[${ATTR_MOBILE}] [${ATTR_SIDEBAR}] [data-slot="sidebar"] > * {
		  width: 100% !important;
		  max-width: 100%;
		}

		/* The right column is fullscreen below 768px and a track above it; either way
		   it is an overlay on a phone, so it only needs the safe-area gutters. */
		body[${ATTR_MOBILE}] [${ATTR_RIGHTBAR}] [class*="_panel"][data-sidebar-right-panel="fullscreen"] {
		  box-sizing: border-box;
		  padding-top: env(safe-area-inset-top, 0px);
		  padding-bottom: env(safe-area-inset-bottom, 0px);
		}

		/* ---------------------------------------------------------- the scrim ----- */
		.dsh-mobile-scrim { display: none; }
		body[${ATTR_MOBILE}] .dsh-mobile-scrim {
		  position: fixed;
		  inset: 0;
		  z-index: 28;
		  display: block;
		  background: var(--dsh-mobile-scrim);
		  opacity: 0;
		  pointer-events: none;
		  transition: opacity var(--dsh-mobile-dur) var(--dsh-mobile-ease);
		}
		body[${ATTR_MOBILE}][${ATTR_DRAWER}="open"] .dsh-mobile-scrim {
		  opacity: 1;
		  pointer-events: auto;
		}

		/* --------------------------------------------- tool calls & trajectory ---- */
		/* Hover-only affordances a touch screen can never reach. */
		body[${ATTR_MOBILE}] [class*="_inspectButton"] { opacity: 1; }
		/* Compact the code-heavy blocks instead of letting them eat the viewport. */
		body[${ATTR_MOBILE}] [class*="_ioSection"] {
		  column-gap: 8px;
		  max-height: 120px;
		  padding: 8px 10px;
		}
		body[${ATTR_MOBILE}] [class*="_terminal"] { --dsl-terminal-output-max-height: 160px; }
		/* The trajectory toolbar is one non-wrapping row; on a phone let it pan. */
		body[${ATTR_MOBILE}] [class*="_root"]:has(> [class*="_ledger"]) > [class*="_root"]:has(> [class*="_inner"]) > [class*="_inner"] {
		  overflow-x: auto;
		  overscroll-behavior-x: contain;
		  scrollbar-width: none;
		}
		body[${ATTR_MOBILE}] [class*="_root"]:has(> [class*="_ledger"]) > [class*="_root"]:has(> [class*="_inner"]) > [class*="_inner"]::-webkit-scrollbar {
		  display: none;
		}

		/* ------------------------------------------------------- save-money ------- */
		/* Its header widget renders a coloured badge ("Save · ▲ 12%") plus an account
		   balance with inline styles, so these rules match its inline-style signature
		   and need the important flag on every property the widget sets inline. On a
		   phone the badge collapses to just its status dot and the balance goes away; a
		   future version that changes the markup simply stops matching and renders as
		   shipped. */
		body[${ATTR_MOBILE}] [class*="_headerUtilities"] span[title][style*="border-radius: 6px"] {
		  display: inline-flex !important;
		  align-items: center;
		  justify-content: center;
		  box-sizing: border-box;
		  width: 20px;
		  height: 20px;
		  margin-right: 0 !important;
		  padding: 0 !important;
		  overflow: hidden;
		  font-size: 0 !important;
		  border-radius: 999px !important;
		  background: color-mix(in srgb, currentColor 16%, transparent);
		}
		body[${ATTR_MOBILE}] [class*="_headerUtilities"] span[title][style*="border-radius: 6px"]::before {
		  content: "";
		  width: 8px;
		  height: 8px;
		  border-radius: 50%;
		  background: currentColor;
		}
		/* The account balance rendered beside it. */
		body[${ATTR_MOBILE}] [class*="_headerUtilities"] [style*="cursor: default"] { display: none; }

		/* ------------------------------------------------------- settings -------- */
		/* Since DSH 0.1.7 the Settings surface is a body portal: the overlay and its
		   800px dialog are createPortal(…, document.body) nodes, so they are no longer
		   descendants of the sidebar's settings seat — and, with no transformed ancestor
		   above them, the drawer needs no promotion while the dialog is open. The dialog
		   is simply addressed through its stable data-shortcut-modal hook.

		   On a phone the desktop dialog also wastes most of its width on the fixed
		   188px navigation column and its margins, so it goes full-bleed and the nav
		   becomes a horizontal tab strip. The nav column is addressed as "the element
		   that directly wraps the nav list", because every class in there shares a
		   _nav prefix (title, list, cell, icon, label). */
		body[${ATTR_MOBILE}] ${SETTINGS_DIALOG} {
		  box-sizing: border-box;
		  width: 100vw;
		  max-width: 100vw;
		  height: 100vh;
		  height: 100dvh;
		  border-radius: 0;
		}
		body[${ATTR_MOBILE}] ${SETTINGS_DIALOG}:has([class*="_navList"]) {
		  flex-direction: column;
		  position: relative;
		}
		body[${ATTR_MOBILE}] ${SETTINGS_DIALOG}:has([class*="_navList"]) > :has(> [class*="_navList"]) {
		  flex-direction: row;
		  align-items: center;
		  box-sizing: border-box;
		  width: 100%;
		  padding: 8px 44px 8px 10px;
		  gap: 8px;
		  border-bottom: .5px solid var(--dsw-alias-border-l2);
		}
		/* the dialog title is redundant once the sections are the tabs */
		body[${ATTR_MOBILE}] ${SETTINGS_DIALOG}:has([class*="_navList"]) [class*="_navTitle"] {
		  display: none;
		}
		body[${ATTR_MOBILE}] ${SETTINGS_DIALOG}:has([class*="_navList"]) [class*="_navList"] {
		  flex-direction: row;
		  gap: 6px;
		  overflow-x: auto;
		  overscroll-behavior-x: contain;
		  scrollbar-width: none;
		}
		body[${ATTR_MOBILE}] ${SETTINGS_DIALOG}:has([class*="_navList"]) [class*="_navList"]::-webkit-scrollbar {
		  display: none;
		}
		body[${ATTR_MOBILE}] ${SETTINGS_DIALOG}:has([class*="_navList"]) [class*="_navCell"] {
		  flex: none;
		  width: auto;
		  height: 34px;
		  padding: 0 14px;
		  border-radius: 999px;
		  white-space: nowrap;
		}
		/* content takes the rest, and scrolls instead of overflowing */
		body[${ATTR_MOBILE}] ${SETTINGS_DIALOG}:has([class*="_navList"]) [class*="_content"] {
		  min-height: 0;
		}
		body[${ATTR_MOBILE}] ${SETTINGS_DIALOG}:has([class*="_navList"]) [class*="_header"] {
		  height: auto;
		  padding: 10px 14px 8px 16px;
		}
		/* keep Close on the tab row rather than below it */
		body[${ATTR_MOBILE}] ${SETTINGS_DIALOG}:has([class*="_navList"]) [class*="_close"] {
		  position: absolute;
		  top: 9px;
		  right: 10px;
		}
		`

		/** Required services: the layout action face and the slot registry. */
		const inject = ['layout', 'slots']

		/**
		 * A tiny external store, so the header trigger follows the drawer state without
		 * a React context (the slot supplies none) and without re-registering.
		 */
		function createDrawerStore() {
		  let snapshot = { open: false, mobile: false, hosted: 0 }
		  const listeners = new Set()
		  const emit = () => {
		    for (const listener of [...listeners]) listener()
		  }
		  return {
		    /** @returns the current immutable snapshot. */
		    get: () => snapshot,
		    /**
		     * @param listener - called on every state change.
		     * @returns the unsubscribe function.
		     */
		    subscribe(listener) {
		      listeners.add(listener)
		      return () => listeners.delete(listener)
		    },
		    /** Register a mounted trigger. */
		    host() {
		      snapshot = { ...snapshot, hosted: snapshot.hosted + 1 }
		      emit()
		    },
		    /** Retract a mounted trigger. */
		    unhost() {
		      snapshot = { ...snapshot, hosted: Math.max(0, snapshot.hosted - 1) }
		      emit()
		    },
		    /** @param patch - fields to merge; a no-op when nothing changes. */
		    set(patch) {
		      const next = { ...snapshot, ...patch }
		      if (next.open === snapshot.open && next.mobile === snapshot.mobile && next.hosted === snapshot.hosted) return
		      snapshot = next
		      emit()
		    },
		  }
		}

		const drawerStore = createDrawerStore()

		/** Set by the mounted controller; the trigger component routes clicks here. */
		let controller = null

		const React = require('react')

		/**
		 * The glyph: three lines while the drawer is closed, a cross while it is open.
		 * @param open - whether the drawer is currently open.
		 * @returns the svg element.
		 */
		function navGlyph(open) {
		  const d = open
		    ? 'M5.4 5.4l9.2 9.2M14.6 5.4l-9.2 9.2'
		    : 'M3.25 5.5h13.5M3.25 10h13.5M3.25 14.5h13.5'
		  return React.createElement(
		    'svg',
		    { viewBox: '0 0 20 20', 'aria-hidden': 'true' },
		    React.createElement('path', {
		      d,
		      fill: 'none',
		      stroke: 'currentColor',
		      strokeWidth: 1.8,
		      strokeLinecap: 'round',
		    }),
		  )
		}

		/**
		 * The trigger registered into `conversation.session.header.utilities`. Its
		 * mount/unmount is also the signal that the phone shell has a header to live in.
		 * @returns the header button.
		 */
		function MobileNavButton() {
		  const state = React.useSyncExternalStore(drawerStore.subscribe, drawerStore.get)
		  React.useEffect(() => {
		    drawerStore.host()
		    return () => drawerStore.unhost()
		  }, [])
		  const label = state.open ? 'Close navigation' : 'Open navigation'
		  return React.createElement(
		    'button',
		    {
		      type: 'button',
		      className: NAV_CLASS,
		      'aria-expanded': state.open ? 'true' : 'false',
		      'aria-controls': DRAWER_ID,
		      'aria-label': label,
		      title: label,
		      onClick: () => {
		        if (controller !== null) controller.toggle()
		      },
		    },
		    navGlyph(state.open),
		  )
		}

		/**
		 * Client plugin body: mount the phone shell, then contribute the header
		 * trigger. The trigger is a slot entry rather than an injected node so React
		 * keeps owning the header tree.
		 * @param ctx - the browser Cordis root context.
		 */
		function apply(ctx) {
		  if (typeof window === 'undefined' || typeof document === 'undefined') return
		  ctx.effect(() => {
		    const shell = mountPhoneShell(ctx)
		    controller = shell
		    return () => {
		      controller = null
		      shell.dispose()
		    }
		  }, 'dsh-mobile: phone shell')
		  ctx.slots.inject(NAV_SLOT, () =>
		    ctx.slots.register(
		      {
		        name: NAV_SLOT,
		        id: 'dsh-mobile-nav',
		        // Last in the utilities list, so the button lands immediately left of
		        // the conversation header's corner control.
		        order: 100,
		      },
		      MobileNavButton,
		    ),
		  )
		}

		/**
		 * Install the stylesheet once per document.
		 * @returns the style element, reused when a previous apply left one behind.
		 */
		function installStyles() {
		  const existing = document.getElementById(STYLE_ID)
		  if (existing) return existing
		  const style = document.createElement('style')
		  style.id = STYLE_ID
		  style.setAttribute('data-plugin', 'dsh-mobile')
		  style.textContent = CSS
		  document.head.appendChild(style)
		  return style
		}

		/** Small helper: build an element from tag, class and optional markup. */
		function el(tag, className, html) {
		  const node = document.createElement(tag)
		  if (className) node.className = className
		  if (html !== undefined) node.innerHTML = html
		  return node
		}

		const GLYPH_OPEN = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3.25 5.5h13.5M3.25 10h13.5M3.25 14.5h13.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>'
		const GLYPH_CLOSE = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5.4 5.4l9.2 9.2M14.6 5.4l-9.2 9.2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>'

		/**
		 * Wait for the shipped frame to exist, decorate it, and wire the drawer.
		 * @param ctx - the browser Cordis root context (for `ctx.layout`).
		 * @returns the controller: `toggle()` plus a disposer for everything added.
		 */
		function mountPhoneShell(ctx) {
		  installStyles()
		  widenViewportForSafeAreas()

		  const media = window.matchMedia(MOBILE_QUERY)
		  const scrim = el('div', 'dsh-mobile-scrim')
		  scrim.setAttribute('aria-hidden', 'true')
		  const fab = el('button', FAB_CLASS, GLYPH_OPEN)
		  fab.type = 'button'
		  fab.setAttribute('aria-controls', DRAWER_ID)
		  document.body.append(scrim, fab)

		  /** Live DOM references; all nullable until the frame mounts. */
		  const dom = { frame: null, sidebar: null, center: null, rightbar: null }
		  let frameObserver = null
		  let lastHosted = -1

		  const isMobile = () => media.matches
		  const drawerOpen = () => dom.frame !== null && !dom.frame.hasAttribute('data-sidebar-collapsed')

		  /**
		   * Locate the shipped frame and tag the columns this plugin styles.
		   * Re-runs when the frame is replaced (a theme-level remount, for example).
		   */
		  function attach() {
		    const overlay = document.querySelector('[data-shell-overlay]')
		    const frame = overlay && overlay.parentElement ? overlay.parentElement : null
		    if (frame === dom.frame) return

		    detachFrame()
		    if (frame === null) return
		    dom.frame = frame
		    dom.sidebar = frame.querySelector('[class*="_sidebarCol"]') || frame.children[0] || null
		    dom.center = frame.querySelector('[class*="_centerCol"]') || frame.children[1] || null
		    dom.rightbar = frame.querySelector('[data-rightbar-col]') || null
		    frame.setAttribute(ATTR_FRAME, '')
		    if (dom.sidebar) {
		      dom.sidebar.setAttribute(ATTR_SIDEBAR, '')
		      dom.sidebar.id = DRAWER_ID
		    }
		    if (dom.center) dom.center.setAttribute(ATTR_CENTER, '')
		    if (dom.rightbar) dom.rightbar.setAttribute(ATTR_RIGHTBAR, '')
		    frameObserver = new MutationObserver(sync)
		    frameObserver.observe(frame, { attributes: true, attributeFilter: ['data-sidebar-collapsed'] })
		    sync()
		  }

		  /** Undo the tagging for the frame we are dropping. */
		  function detachFrame() {
		    if (frameObserver !== null) {
		      frameObserver.disconnect()
		      frameObserver = null
		    }
		    const tagged = [
		      [dom.frame, ATTR_FRAME],
		      [dom.sidebar, ATTR_SIDEBAR],
		      [dom.center, ATTR_CENTER],
		      [dom.rightbar, ATTR_RIGHTBAR],
		    ]
		    for (const [node, attribute] of tagged) {
		      if (node) node.removeAttribute(attribute)
		    }
		    // The id exists only for the triggers' aria-controls.
		    if (dom.sidebar && dom.sidebar.id === DRAWER_ID) dom.sidebar.removeAttribute('id')
		    dom.frame = null
		    dom.sidebar = null
		    dom.center = null
		    dom.rightbar = null
		  }

		  /**
		   * Project the shipped column state onto the body and both triggers. The
		   * header trigger can only exist while its header does, so `hosted` decides
		   * which of the two is the live one.
		   */
		  function sync() {
		    const mobile = isMobile()
		    const hosted = drawerStore.get().hosted > 0
		    lastHosted = drawerStore.get().hosted
		    const open = mobile && drawerOpen()

		    document.body.toggleAttribute(ATTR_MOBILE, mobile)
		    document.body.toggleAttribute(ATTR_HEADER_NAV, hosted)
		    const state = open ? 'open' : 'closed'
		    if (document.body.getAttribute(ATTR_DRAWER) !== state) document.body.setAttribute(ATTR_DRAWER, state)

		    const label = open ? 'Close navigation' : 'Open navigation'
		    fab.innerHTML = open ? GLYPH_CLOSE : GLYPH_OPEN
		    fab.setAttribute('aria-expanded', open ? 'true' : 'false')
		    fab.setAttribute('aria-label', label)
		    fab.title = label

		    drawerStore.set({ open, mobile })
		  }

		  /**
		   * React re-renders on the store change without re-running `sync`; only a
		   * changed trigger count needs the body attribute refreshed.
		   */
		  const onStoreChange = () => {
		    if (drawerStore.get().hosted === lastHosted) return
		    sync()
		  }
		  const unsubscribe = drawerStore.subscribe(onStoreChange)

		  /** Open or close the drawer through the shipped layout action. */
		  function toggle() {
		    if (!isMobile() || dom.frame === null) return
		    ctx.layout.toggleSidebar()
		  }

		  /**
		   * A click inside the drawer is a navigation when it lands on a control that
		   * leaves the current view — New Session, a global panel row, Settings, or a
		   * row that is (or is about to be) the selected session. Expanding a
		   * workspace does none of those, so the drawer stays put.
		   * @param target - the click target.
		   */
		  function isNavigation(target) {
		    if (!(target instanceof Element)) return false
		    // Settings is deliberately absent: its panel lives inside this drawer, so
		    // closing the drawer would take the panel with it (see the stylesheet).
		    if (target.closest('[class*="_newSession"], [class*="_panelRow"]')) return true
		    const item = target.closest('[role="treeitem"], [role="option"], a[href]')
		    return item !== null && item.getAttribute('aria-selected') === 'true'
		  }

		  const onScrim = () => toggle()
		  const onFab = () => toggle()

		  const onDrawerClick = (event) => {
		    if (!drawerOpen()) return
		    const target = event.target
		    if (!(target instanceof Element)) return
		    if (isNavigation(target)) {
		      toggle()
		      return
		    }
		    // A session row can only mark itself selected in the render that follows.
		    const item = target.closest('[role="treeitem"], [role="option"]')
		    if (item === null) return
		    requestAnimationFrame(() => {
		      if (item.getAttribute('aria-selected') === 'true') toggle()
		    })
		  }

		  const onKeyDown = (event) => {
		    if (event.key === 'Escape' && drawerOpen()) toggle()
		  }

		  /**
		   * On a phone the software keyboard's return key is the only Enter a user has:
		   * there is no Shift+Enter to reach for. The shipped composer sends on Enter,
		   * so every intended line break becomes an accidental submission.
		   *
		   * Stop that one keydown before it reaches the submit handler — and nothing
		   * else: no `preventDefault`, so the browser's own editing default still runs,
		   * and the editor's `beforeinput` path turns it into a paragraph break exactly
		   * as Shift+Enter would. Modifiers are deliberately let through, so a hardware
		   * keyboard attached to a phone can still send, and the media-query gate keeps
		   * desktop byte-for-byte as shipped. IME composition is left alone too.
		   */
		  const onComposerKeyDown = (event) => {
		    if (!isMobile()) return
		    if (event.key !== 'Enter' || event.shiftKey || event.altKey || event.ctrlKey || event.metaKey) return
		    if (event.isComposing || event.keyCode === 229) return
		    const target = event.target
		    if (!(target instanceof Element) || target.closest(COMPOSER_SELECTOR) === null) return
		    event.stopPropagation()
		  }

		  // Horizontal swipe: left on the open drawer closes it; a drag that starts at
		  // the very edge of the screen opens it. Vertical movement disqualifies both,
		  // so list scrolling is untouched.
		  let swipe = null
		  const onTouchStart = (event) => {
		    if (event.touches.length !== 1) {
		      swipe = null
		      return
		    }
		    const touch = event.touches[0]
		    swipe = { x: touch.clientX, y: touch.clientY, fromEdge: touch.clientX <= 24 }
		  }
		  const onTouchEnd = (event) => {
		    const start = swipe
		    swipe = null
		    if (start === null || event.changedTouches.length !== 1) return
		    const touch = event.changedTouches[0]
		    const dx = touch.clientX - start.x
		    const dy = touch.clientY - start.y
		    if (Math.abs(dy) > 48 || Math.abs(dx) < 64) return
		    if (dx < 0 && drawerOpen()) toggle()
		    else if (dx > 0 && start.fromEdge && !drawerOpen()) toggle()
		  }

		  scrim.addEventListener('click', onScrim)
		  fab.addEventListener('click', onFab)
		  document.addEventListener('keydown', onKeyDown)
		  // Capture phase, so it runs before the composer's own submit handler.
		  document.addEventListener('keydown', onComposerKeyDown, true)
		  document.addEventListener('touchstart', onTouchStart, { passive: true })
		  document.addEventListener('touchend', onTouchEnd, { passive: true })
		  document.addEventListener('click', onDrawerClick)

		  // The shell mounts the frame asynchronously. A cheap poll (two querySelector
		  // calls) survives a replaced frame without observing the chat's stream.
		  const poll = window.setInterval(attach, 750)

		  const onMediaChange = () => sync()
		  if (typeof media.addEventListener === 'function') media.addEventListener('change', onMediaChange)
		  else if (typeof media.addListener === 'function') media.addListener(onMediaChange)

		  attach()
		  sync()

		  return {
		    toggle,
		    dispose() {
		      window.clearInterval(poll)
		      unsubscribe()
		      if (typeof media.removeEventListener === 'function') media.removeEventListener('change', onMediaChange)
		      else if (typeof media.removeListener === 'function') media.removeListener(onMediaChange)
		      document.removeEventListener('keydown', onKeyDown)
		      document.removeEventListener('keydown', onComposerKeyDown, true)
		      document.removeEventListener('touchstart', onTouchStart)
		      document.removeEventListener('touchend', onTouchEnd)
		      document.removeEventListener('click', onDrawerClick)
		      detachFrame()
		      document.body.removeAttribute(ATTR_MOBILE)
		      document.body.removeAttribute(ATTR_HEADER_NAV)
		      document.body.removeAttribute(ATTR_DRAWER)
		      scrim.remove()
		      fab.remove()
		      const style = document.getElementById(STYLE_ID)
		      if (style !== null) style.remove()
		    },
		  }
		}

		/**
		 * Ask for the notch-safe viewport. The shipped index.html pins
		 * `width=device-width, initial-scale=1`; `viewport-fit=cover` is what makes
		 * `env(safe-area-inset-*)` resolve to anything but zero in a standalone PWA.
		 * Purely progressive: a browser that ignores the late change keeps the plain
		 * viewport and the insets stay 0.
		 */
		function widenViewportForSafeAreas() {
		  const meta = document.querySelector('meta[name="viewport"]')
		  if (meta === null) return
		  const content = meta.getAttribute('content') || ''
		  if (content.includes('viewport-fit')) return
		  meta.setAttribute('content', `${content}, viewport-fit=cover`)
		}

		exports.inject = inject
		exports.apply = apply

		return module.exports;
	}
});
