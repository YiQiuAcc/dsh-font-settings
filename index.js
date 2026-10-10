/**
 * Host half of the dsh-font-settings bundle — a mount shell only.
 *
 * The bundle is a profile bundle, so it needs a mountable Host plugin for the
 * Loader row to exist; the browser bundle is discovered from that live entry.
 * Everything the plugin does happens in `client.js`, which reads and writes the
 * harness theme service, so this half owns no state, no route, and no index
 * injection.
 */

/** Mount the plugin. The browser half carries all behavior. */
export function apply() {}
