/**
 * Host loader entry for dsh-mobile.
 *
 * The plugin is browser-only: everything it does happens in the client half
 * (`lib/client.js`), which the modules node half serves at
 * `/plugins/dsh-mobile/client.js` because this package declares
 * `dsh.client.platform: "web"`. The host row exists so the Loader tree has an
 * entry for the package — that entry is what puts the bundle on the browser
 * roster, and it gives the plugin a place to hang host-side behavior later
 * (a settings namespace for the breakpoint, say).
 */

/** Plugin name, matching the Loader row id and the registered bundle id. */
export const name = 'dsh-mobile'

/** No host-side behavior. */
export function apply() {}
