# dsh-font-settings

English | [中文](README.zh.md)

A [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) web plugin that replaces the font settings in **Settings → General** with searchable font pickers: text, code, and terminal fonts are set independently, and the fonts installed on your machine can be listed on request.

The shipped rows ask you to type a comma-separated font name from memory. This plugin shows you the list instead — and draws every candidate in its own face, so you pick by sight.

## Features

- **Searchable pickers** for the text, code, and terminal font roles. Focus or type to open the list; ↑/↓ move with wrap-around, Enter applies, Escape cancels the edit, a click outside closes it.
- **Every row is drawn in the family it would apply**, so a candidate is recognized by how it looks rather than by its name.
- **Free text still works.** Anything not in the list can be typed; the harness normalizes it (names are quoted, generic families stay bare) and it becomes the field's value.
- **Load the fonts installed on this machine** with one button (Chromium-based browsers expose the list through `queryLocalFonts`; where it is unsupported or denied, the button says so and everything else keeps working). The catalog is searchable rather than dumped: type part of a family name and its matches are listed.
- **Font size for every role**, next to its font picker.
- **Collapsed by default** to a single "Font settings" row with a chevron disclosure, so the General list stays compact. The current text font is summarised on the collapsed row.
- **The system default is always one click away** — the first entry in every list clears the override.

## Install

The plugin installs as a profile bundle. Use the Web sidebar's **Plugins** page, or the `plugin_manager` tool's `install_bundle` (it requires `danger-full-access`). The spec can be a git address, a local path, or a registry name:

- **From GitHub**: `https://github.com/yiqiuacc/dsh-font-settings.git` (the manager runs `git ls-remote` against GitHub before installing; pnpm's `github:yiqiuacc/dsh-font-settings` shorthand works too).
- **From a local checkout**: `link:<absolute path to this directory>`.
- **From a registry** once published: `@styiqiu/dsh-font-settings`.

Installing enables the bundle by default. Opening **Settings → General** then shows one "Font settings" row where the built-in font group used to be.

## Where the choice is stored

The plugin owns no storage and no stylesheet. Every read and write goes through the harness theme service (`ctx.theme`), so the shipped machinery does the rest:

- **Persistence** — the settings scope stores each list and size; the profile records them as the `ui-theme` config row of its `cordis.patch.yml`.
- **First paint** — the harness boot script embeds the stored lists into the served index HTML, so a page never flashes the default font before applying yours.
- **Application** — the theme presenter writes `--dsh-font-family-<role>` onto `body` as inline styles, and the token sheet composes the interface and code stacks from them.

Because both surfaces read one store, this plugin's choices and the built-in font rows are always the same data. (Once installed, the built-in rows are not rendered — they are shadowed, see below.)

## How it works

- `client.js` is the whole plugin. It registers one entry in the General section's item slot **using the built-in entry's id at a lower priority**, which shadows that entry: a list slot renders one row per id and the lowest priority wins. The group replaces the built-in font rows rather than sitting beside them.
- The field and the candidate card are the shared client primitives — `Input`, `MenuSurface`, and `MenuGroup` from `@deepseek-ai/dsh-client-ui-primitives`, a client baseline module — so the shared field geometry, menu material, sticky group headings, and focus behavior come from the harness rather than from this plugin.
- The committed list is adopted as the field's text only while the field does not hold the keyboard, so a write landing while you type — including the echo of your own commit — cannot replace what you typed or move the caret.
- The `theme` service is taken through a scoped injection (`ctx.inject(['theme'], …)`). Where that service is absent, the plugin registers nothing at all: the built-in font settings keep their place and the plugin is simply inert. The outer plugin never waits on the service, so a composition without it still boots.
- `index.js` is an **empty mount shell** (`export function apply() {}`). A profile bundle needs a mountable Host plugin for the Loader row to exist, and the browser bundle is discovered from that live entry — but this plugin has no Host-side behavior left.
- No build step and no dependencies of its own: plain ES modules, with React and the client primitives supplied by the client module loader.

## Compatibility

- DeepSeek Harness `0.2.x` web (and Desktop, which uses the same web profile template).
- The local-font button needs a Chromium-based browser. Everything else is engine-neutral.
- `ctx.theme` is a **pre-stable API**: the harness states that public APIs can change, so a harness upgrade may require updating this plugin.

## Known limitations

- **The local catalog is listed only while filtering, and at most 24 rows of it.** Every row is painted in the family it would apply, and a cold font cache loads one font face per distinct family — hundreds of rows in one open stall the page for seconds. The curated list is unaffected; a filtered local list costs about what the curated one costs.
- **The group sits above "Appearance".** Shadowing requires a lower slot priority, and a list slot sorts by priority, so the group renders first in the General section. This cannot be avoided while replacing the built-in rows.
- **It depends on the built-in entry id `font-size`.** If a future harness renames that entry, the shadow stops applying and this group renders **beside** the built-in font rows instead of replacing them — duplicated controls, no crash and no error.
- **The roles are independent.** There is no "also replace the monospace font" switch: the code and terminal roles have their own pickers.
- **No separate preview block** — each list row is already drawn in its own face.
- **No font-size formatting beyond the harness ranges** (text 10–22, code 10–16, terminal 10–20 px); the steppers clamp to them.

## Development

There is nothing to build and nothing to install.

- Edit `client.js` and reload the page — the client bundle is fetched per page load.
- Only a change to `index.js` (the mount shell) needs a server restart.
- `README.zh.md` is the Chinese counterpart of this file.

## License

[MIT](LICENSE)
