/**
 * Browser half of the dsh-font-settings bundle: it takes over the General
 * section's font settings group and replaces each role's comma-separated text
 * field with a searchable picker whose rows are drawn in their own face —
 * the system default, a curated list of common families, and the families the
 * browser is willing to enumerate on request.
 *
 * Storage and application belong to the harness theme service: every choice is
 * written with `ctx.theme.setFontFamily` / `setFontSize`, so persistence, the
 * first-paint boot script, the body inline variables, and the token
 * composition remain the shipped ones. This half owns presentation only.
 *
 * The group is registered as the General slot entry `font-size` at a priority
 * below the built-in one, which shadows that entry: the list slot renders one
 * row per id, and the lowest priority wins. That is a deliberate coupling to a
 * first-party id — if the shipped entry ever stops using it, this group simply
 * renders beside the built-in one instead of replacing it.
 *
 * The `theme` service is taken through a scoped injection, so a composition
 * without it registers nothing at all: the built-in group stays untouched and
 * this plugin is inert. The outer plugin declares only the services it reads
 * at apply time, so it never waits on `theme` and never blocks the boot audit.
 */
window.__ModuleLoader__.load({
  id: '@styiqiu/dsh-font-settings',
  factory(require) {
    const React = require('react')
    const h = React.createElement

    /** Dictionary namespace owned by this plugin. */
    const NS = 'dsh.fontSettings'
    /** Built-in General slot entry this group shadows; see the module note. */
    const SHADOWED_ENTRY_ID = 'font-size'
    /** Slot priority below the built-in entry's default 0, which makes this entry the rendering winner. */
    const ENTRY_PRIORITY = -1
    /**
     * Font roles with the size range the theme service accepts for each. The
     * ranges mirror the service's own specs; a value outside them is rejected,
     * so the steppers clamp first and still read back the accepted value.
     */
    const ROLES = Object.freeze([
      Object.freeze({ role: 'text', min: 10, max: 22, fallback: 14 }),
      Object.freeze({ role: 'code', min: 10, max: 16, fallback: 11 }),
      Object.freeze({ role: 'terminal', min: 10, max: 20, fallback: 13 }),
    ])
    /** Id prefix of one role's listbox, referenced by its input's aria-controls. */
    const LIST_ID_PREFIX = 'dsh-font-settings-list-'
    /** Id prefix of one option row, referenced by the input's aria-activedescendant. */
    const OPTION_ID_PREFIX = 'dsh-font-settings-option-'

    /** Chinese dictionary. */
    const zh = {
      'group.title': '字体设置',
      'group.description': '正文字体、代码字体与终端字体，各自独立',
      'font.text.title': '正文字体',
      'font.text.description': '用于界面与会话正文',
      'font.code.title': '代码字体',
      'font.code.description': '用于代码块、行内代码与工具输出',
      'font.terminal.title': '终端字体',
      'font.terminal.description': '用于侧栏终端',
      'font.search': '搜索或输入字体名称…',
      'font.default': '跟随系统（默认）',
      'font.presets': '常见字体',
      'font.local': '本机字体',
      'font.custom': '使用：',
      'font.suggestions': '字体建议',
      'font.loadLocal': '加载本机全部字体…',
      'font.localUnavailable': '本机字体列表不可用：浏览器不支持或未授权',
      'font.loaded': '已加载本机字体',
      'size.text.title': '字号大小',
      'size.code.title': '代码字号',
      'size.terminal.title': '终端字号',
      'size.decrease': '减小',
      'size.increase': '增大',
      'size.unit': 'px',
    }

    /** English dictionary. */
    const en = {
      'group.title': 'Font settings',
      'group.description': 'Text, code, and terminal fonts, each set independently',
      'font.text.title': 'Text font',
      'font.text.description': 'Used for the interface and conversation text',
      'font.code.title': 'Code font',
      'font.code.description': 'Used for code blocks, inline code, and tool output',
      'font.terminal.title': 'Terminal font',
      'font.terminal.description': 'Used for the sidebar terminal',
      'font.search': 'Search or type a font name…',
      'font.default': 'System default',
      'font.presets': 'Common fonts',
      'font.local': 'Local fonts',
      'font.custom': 'Use: ',
      'font.suggestions': 'Font suggestions',
      'font.loadLocal': 'Load all local fonts…',
      'font.localUnavailable': 'Local font list unavailable: unsupported by the browser or not permitted',
      'font.loaded': 'Local fonts loaded',
      'size.text.title': 'Text size',
      'size.code.title': 'Code size',
      'size.terminal.title': 'Terminal size',
      'size.decrease': 'Decrease',
      'size.increase': 'Increase',
      'size.unit': 'px',
    }

    /** Curated list entries; the system default is offered outside this list. */
    const PRESETS = [
      "'Microsoft YaHei', '微软雅黑', sans-serif",
      "'Segoe UI', sans-serif",
      'Arial, Helvetica, sans-serif',
      'Verdana, Geneva, sans-serif',
      'Tahoma, Geneva, sans-serif',
      'Georgia, serif',
      "'Times New Roman', Times, serif",
      "DengXian, '等线', sans-serif",
      "SimSun, '宋体', serif",
      "NSimSun, '新宋体', serif",
      "SimHei, '黑体', sans-serif",
      "KaiTi, '楷体', serif",
      "FangSong, '仿宋', serif",
      'Consolas, monospace',
      "'Courier New', Courier, monospace",
      "'SF Mono', Monaco, monospace",
      "'JetBrains Mono', 'Fira Code', monospace",
      "'LXGW WenKai', '霞鹜文楷', sans-serif",
    ]

    /**
     * Quote one local font family as a single CSS family name.
     * @param name - family name reported by the local font catalog.
     * @returns a quoted family usable as a font stack.
     */
    function quoteFamily(name) {
      return `"${name.replace(/["\\]/g, '').trim()}"`
    }

    /**
     * Subscribe to the theme service for the lifetime of a component.
     * @param scope - the context holding the service.
     * @returns the current snapshot, re-rendering the caller on every change.
     */
    function useThemeSnapshot(scope) {
      const [snapshot, setSnapshot] = React.useState(() => scope.theme.getTheme())
      React.useEffect(() => scope.on('theme/change', setSnapshot), [])
      return snapshot
    }

    /**
     * One role's searchable font picker: an input that commits free text on blur
     * or Enter and opens a listbox of candidates while focused. Rows are drawn in
     * the family they would apply, so a name can be chosen by sight.
     * @param props - role, the persisted list, the commit callback, and the local catalog.
     * @returns the picker element tree.
     */
    function FontPicker(props) {
      const { t, role, value, commit, localFonts } = props
      const [query, setQuery] = React.useState(value)
      // Filtering text is separate from the field: focusing a field that already
      // holds a value must still offer the whole list.
      const [filter, setFilter] = React.useState('')
      const [open, setOpen] = React.useState(false)
      const [highlight, setHighlight] = React.useState(-1)
      const box = React.useRef(null)
      const listId = `${LIST_ID_PREFIX}${role}`
      const title = t(`font.${role}.title`)

      // The picker is a popup, so it closes on a press outside its own box.
      React.useEffect(() => {
        if (!open) return undefined
        const onPointerDown = (event) => {
          const node = box.current
          if (node !== null && !node.contains(event.target)) setOpen(false)
        }
        document.addEventListener('mousedown', onPointerDown)
        return () => document.removeEventListener('mousedown', onPointerDown)
      }, [open])

      const typed = filter.trim()
      const field = query.trim()
      const needle = typed.toLowerCase()
      const matches = (text) => needle === '' || text.toLowerCase().includes(needle)
      const accepted = (text) => { setQuery(text); setFilter(''); commit(text) }

      // One flat row model: `header` rows are section labels, everything else is
      // a pickable option carrying the family stack it applies.
      const rows = []
      if (matches(t('font.default'))) {
        rows.push({ key: '__default__', label: t('font.default'), family: '' })
      }
      const curated = PRESETS.filter(preset => matches(preset))
      if (curated.length > 0) {
        rows.push({ key: '__presets__', header: t('font.presets') })
        for (const preset of curated) rows.push({ key: `preset:${preset}`, label: preset, family: preset })
      }
      const locals = localFonts.filter(name => matches(name) || matches(quoteFamily(name)))
      if (locals.length > 0) {
        rows.push({ key: '__local__', header: t('font.local') })
        for (const name of locals) rows.push({ key: `local:${name}`, label: name, family: quoteFamily(name) })
      }
      const exact = curated.includes(typed) || locals.some(name => name === typed || quoteFamily(name) === typed)
      if (typed !== '' && !exact) {
        rows.push({ key: '__typed__', label: t('font.custom') + typed, family: typed })
      }
      const selectable = rows.map((row, index) => row.header === undefined ? index : -1).filter(index => index >= 0)
      const active = rows[highlight] !== undefined && rows[highlight].header === undefined ? highlight : -1

      /** Close the list, drop the filter, and apply one row. */
      const pick = (row) => {
        setOpen(false)
        setHighlight(-1)
        accepted(row.family)
      }

      /** Move the highlight by one selectable row, wrapping at both ends. */
      const move = (step) => {
        if (selectable.length === 0) return
        const at = selectable.indexOf(highlight)
        if (at === -1) {
          setHighlight(step > 0 ? selectable[0] : selectable[selectable.length - 1])
          return
        }
        setHighlight(selectable[(at + step + selectable.length) % selectable.length])
      }

      /**
       * Apply the text being entered, or re-commit the field when nothing was
       * typed: a bare Enter must never clear a font that is already set.
       */
      const applyTyped = () => {
        const wanted = typed !== '' ? typed : field
        const named = rows.find(row => row.family === wanted)
        if (named !== undefined) pick(named)
        else accepted(wanted)
      }

      /** Picker keys: arrows move, Enter applies, Escape dismisses. */
      const onKeyDown = (event) => {
        // oxlint-disable-next-line no-unused-expressions -- some IMEs report composition only through keyCode 229.
        if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return
        if (event.key === 'ArrowDown') {
          event.preventDefault()
          setOpen(true)
          move(1)
          return
        }
        if (event.key === 'ArrowUp') {
          event.preventDefault()
          setOpen(true)
          move(-1)
          return
        }
        if (event.key === 'Escape') {
          if (!open) return
          event.preventDefault()
          setOpen(false)
          setHighlight(-1)
          setQuery(value)
          setFilter('')
          return
        }
        if (event.key === 'Enter') {
          event.preventDefault()
          const row = rows[highlight]
          if (open && row !== undefined && row.header === undefined) pick(row)
          else applyTyped()
        }
      }

      const option = (row, index) => h('div', {
        key: row.key,
        id: `${OPTION_ID_PREFIX}${role}-${String(index)}`,
        role: 'option',
        'aria-selected': row.family === value,
        onMouseDown: (event) => { event.preventDefault(); pick(row) },
        style: {
          display: 'flex',
          gap: 8,
          alignItems: 'center',
          padding: '7px 10px',
          borderRadius: 6,
          cursor: 'pointer',
          color: 'var(--dsw-alias-label-primary)',
          background: index === highlight ? 'var(--dsw-alias-bg-layer-2)' : 'transparent',
        },
      },
      h('span', {
        style: {
          flex: '1 1 auto',
          minWidth: 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          fontFamily: row.family === '' ? undefined : row.family,
          fontSize: 15,
          lineHeight: '22px',
        },
      }, row.label),
      row.family === value && h('span', {
        style: { flex: 'none', color: 'var(--dsw-alias-brand-primary)' },
        'aria-hidden': true,
      }, '✓'))

      const listRow = (row, index) => row.header !== undefined
        ? h('div', {
          key: row.key,
          style: {
            padding: '6px 10px 2px',
            fontSize: 12,
            lineHeight: '18px',
            color: 'var(--dsw-alias-label-tertiary)',
          },
        }, row.header)
        : option(row, index)

      return h('div', { ref: box, style: { position: 'relative', width: '100%' } },
        h('input', {
          type: 'search',
          value: query,
          role: 'combobox',
          'aria-expanded': open,
          'aria-controls': listId,
          'aria-autocomplete': 'list',
          'aria-activedescendant': active === -1 ? undefined : `${OPTION_ID_PREFIX}${role}-${String(active)}`,
          'aria-label': title,
          placeholder: t('font.search'),
          spellCheck: false,
          autoComplete: 'off',
          onFocus: () => { setOpen(true); setHighlight(-1); setFilter('') },
          // Committing with Enter closes the list but keeps focus on the field,
          // so a press has to reopen it; the typed filter stays as it is.
          onClick: () => { setOpen(true) },
          onChange: (event) => { setQuery(event.target.value); setFilter(event.target.value); setOpen(true); setHighlight(-1) },
          onKeyDown,
          onBlur: () => { setOpen(false); accepted(query) },
          style: {
            boxSizing: 'border-box',
            width: '100%',
            padding: '7px 10px',
            borderRadius: 'var(--dsw-radius-md)',
            border: '0.5px solid var(--dsw-alias-border-l4)',
            background: 'var(--dsw-alias-bg-layer-1)',
            color: 'var(--dsw-alias-label-primary)',
            fontFamily: 'inherit',
            fontSize: 14,
            lineHeight: '22px',
          },
        }),
        open && h('div', {
          id: listId,
          role: 'listbox',
          'aria-label': t('font.suggestions'),
          style: {
            position: 'absolute',
            zIndex: 30,
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            maxHeight: 280,
            overflowY: 'auto',
            padding: 4,
            borderRadius: 'var(--dsw-radius-md)',
            border: '0.5px solid var(--dsw-alias-border-l4)',
            background: 'var(--dsw-alias-bg-layer-1)',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.18)',
          },
        }, rows.map(listRow)))
    }

    /**
     * One role's font-size stepper.
     * @param props - role bounds, the current px, and the change callback.
     * @returns the stepper element tree.
     */
    function SizeStepper(props) {
      const { t, role, min, max, px, change } = props
      const label = t(`size.${role}.title`)
      const button = (delta, text, disabled) => h('button', {
        type: 'button',
        'aria-label': `${t(delta > 0 ? 'size.increase' : 'size.decrease')} ${label}`,
        disabled,
        onClick: () => { change(px + delta) },
        style: {
          boxSizing: 'border-box',
          width: 26,
          height: 26,
          padding: 0,
          borderRadius: 'var(--dsw-radius-sm)',
          border: '0.5px solid var(--dsw-alias-border-l4)',
          background: 'var(--dsw-alias-bg-layer-1)',
          color: disabled ? 'var(--dsw-alias-label-caption)' : 'var(--dsw-alias-label-primary)',
          cursor: disabled ? 'default' : 'pointer',
          font: 'inherit',
          lineHeight: 1,
        },
      }, text)
      return h('div', {
        role: 'group',
        'aria-label': label,
        style: { display: 'flex', gap: 6, alignItems: 'center', flex: 'none' },
      },
      button(-1, '−', px <= min),
      h('span', {
        style: {
          minWidth: 46,
          textAlign: 'center',
          fontSize: 13,
          lineHeight: '20px',
          color: 'var(--dsw-alias-label-secondary)',
        },
      }, `${String(px)} ${t('size.unit')}`),
      button(1, '+', px >= max))
    }

    /**
     * Build the General-section font group bound to one theme service.
     * @param scope - the context holding the service this group reads and writes.
     * @returns the group component.
     */
    function createGroup(scope) {
      /**
       * The font settings group: one row per role, each pairing a searchable
       * font picker with its size stepper.
       * @param props - slot props (locale seat `t`).
       * @returns the group element tree.
       */
      return function FontSettingsGroup(props) {
        const t = typeof props.t === 'function' ? props.t : key => key
        const snapshot = useThemeSnapshot(scope)
        const [localFonts, setLocalFonts] = React.useState([])
        const [localNote, setLocalNote] = React.useState('')
        const loaded = localFonts.length > 0
        const [open, setOpen] = React.useState(false)
        const regionId = React.useId()
        // Inline styles cannot carry :hover, so the chips that need a hover wash
        // (the disclosure and the local-font action) track it in one state.
        const [hovered, setHovered] = React.useState('')

        /** Ask the browser for the installed families; the click is the gesture the permission needs. */
        const loadLocalFonts = () => {
          if (typeof window.queryLocalFonts !== 'function') {
            setLocalNote(t('font.localUnavailable'))
            return
          }
          window.queryLocalFonts().then((faces) => {
            const names = new Set()
            for (const face of faces) {
              const name = String(face.family ?? '').trim()
              if (name !== '') names.add(name)
            }
            setLocalFonts(Array.from(names).sort((left, right) => left.localeCompare(right)))
            setLocalNote(t('font.loaded'))
          }, () => { setLocalNote(t('font.localUnavailable')) })
        }

        /** Commit one role's list; the service normalizes it and the snapshot carries the accepted value back. */
        const commitFamily = (role, text) => {
          try {
            scope.theme.setFontFamily(role, text)
          } catch (error) {
            scope.logger?.warn?.(`font-settings: setFontFamily(${role}) rejected: ${String(error)}`)
          }
        }

        /** Commit one role's size, clamped to the range the service accepts. */
        const commitSize = (spec, px) => {
          const bounded = Math.min(spec.max, Math.max(spec.min, Math.round(px)))
          try {
            scope.theme.setFontSize(spec.role, bounded)
          } catch (error) {
            scope.logger?.warn?.(`font-settings: setFontSize(${spec.role}, ${String(bounded)}) rejected: ${String(error)}`)
          }
        }

        const title = { fontSize: 14, lineHeight: '22px', color: 'var(--dsw-alias-label-primary)' }
        const desc = { fontSize: 13, lineHeight: '20px', color: 'var(--dsw-alias-label-secondary)' }

        const row = (spec) => {
          const px = snapshot.fontSizes[spec.role] ?? spec.fallback
          return h('div', {
            key: spec.role,
            style: {
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              padding: '16px 0',
              borderBottom: '0.5px solid var(--dsw-alias-border-l2)',
            },
          },
          h('div', { style: { display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between' } },
            h('div', { style: { display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 } },
              h('div', { style: title }, t(`font.${spec.role}.title`)),
              h('div', { style: desc }, t(`font.${spec.role}.description`))),
            h(SizeStepper, {
              t,
              role: spec.role,
              min: spec.min,
              max: spec.max,
              px,
              change: (next) => { commitSize(spec, next) },
            })),
          h(FontPicker, {
            key: snapshot.fontFamilies[spec.role],
            t,
            role: spec.role,
            value: snapshot.fontFamilies[spec.role],
            commit: (text) => { commitFamily(spec.role, text) },
            localFonts,
          }))
        }

        const localRow = h('div', {
          style: {
            display: 'flex',
            flexWrap: 'wrap',
            gap: 12,
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 0 0',
          },
        },
        h('button', {
          type: 'button',
          disabled: loaded,
          onClick: loadLocalFonts,
          onMouseEnter: () => { setHovered('local') },
          onMouseLeave: () => { setHovered('') },
          style: {
            boxSizing: 'border-box',
            padding: '6px 12px',
            borderRadius: 'var(--dsw-radius-md)',
            border: '0.5px solid var(--dsw-alias-border-l4)',
            background: hovered === 'local' && !loaded ? 'var(--dsw-alias-interactive-bg-hover)' : 'var(--dsw-alias-bg-layer-1)',
            color: loaded ? 'var(--dsw-alias-label-caption)' : 'var(--dsw-alias-label-primary)',
            cursor: loaded ? 'default' : 'pointer',
            font: 'inherit',
            fontSize: 13,
            lineHeight: '20px',
            whiteSpace: 'nowrap',
          },
        }, loaded ? `${t('font.loaded')}（${String(localFonts.length)}）` : t('font.loadLocal')),
        localNote !== '' && h('span', {
          style: {
            fontSize: 13,
            lineHeight: '20px',
            color: localNote === t('font.localUnavailable')
              ? 'var(--dsw-alias-state-warn-primary)'
              : 'var(--dsw-alias-label-tertiary)',
          },
        }, localNote))

        // The disclosure stays the group's only collapsed content, so the
        // General list keeps one compact row until the user opens it.
        const header = h('div', {
          style: {
            display: 'flex',
            gap: 12,
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 0',
            borderBottom: open ? 'none' : '0.5px solid var(--dsw-alias-border-l2)',
          },
        },
        h('div', { style: { display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 } },
          h('div', { style: title }, t('group.title')),
          h('div', { style: desc }, t('group.description')),
          snapshot.fontFamilies.text !== '' && h('div', {
            style: {
              fontSize: 12,
              lineHeight: '18px',
              color: 'var(--dsw-alias-label-tertiary)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            },
          }, snapshot.fontFamilies.text)),
        h('button', {
          type: 'button',
          'aria-expanded': open,
          'aria-controls': regionId,
          'aria-label': t('group.title'),
          onClick: () => { setOpen(value => !value) },
          onMouseEnter: () => { setHovered('toggle') },
          onMouseLeave: () => { setHovered('') },
          style: {
            boxSizing: 'border-box',
            flex: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 24,
            height: 24,
            padding: 0,
            border: 'none',
            borderRadius: 'var(--dsw-radius-xs)',
            background: hovered === 'toggle' ? 'var(--dsw-alias-interactive-bg-hover)' : 'transparent',
            color: 'var(--dsw-alias-label-tertiary)',
            cursor: 'pointer',
          },
        },
        // One chevron, flipped by the expanded state: v while collapsed, ^ while open.
        h('svg', {
          width: 16,
          height: 16,
          viewBox: '0 0 16 16',
          'aria-hidden': true,
          focusable: false,
          style: {
            transform: open ? 'rotate(180deg)' : 'none',
            transition: 'transform var(--ds-transition-duration-fast) var(--ds-ease-in-out)',
          },
        },
        h('polyline', {
          points: '3.5,6 8,10.5 12.5,6',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.6,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
        }))))

        return h('div', { style: { display: 'flex', flexDirection: 'column', width: '100%' } },
          header,
          open && h('div', { id: regionId }, ROLES.map(row), localRow))
      }
    }

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        try {
          ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-font-settings: dictionaries')
        } catch (error) {
          // A missing dictionary costs copy, not the page.
          console.error('dsh-font-settings: the dictionaries did not register', error)
        }
        // Scoped injection: without the theme service nothing is registered, the
        // built-in group keeps its place, and this plugin stays inert.
        ctx.inject(['theme'], (scope) => {
          // Registration runs once the General section declares the slot, and the
          // declaration stays live with it.
          scope.slots.inject('settings.general.item', () => scope.slots.register({
            name: 'settings.general.item',
            id: SHADOWED_ENTRY_ID,
            priority: ENTRY_PRIORITY,
            locale: NS,
          }, createGroup(scope)))
        })
      },
    }
  },
})
