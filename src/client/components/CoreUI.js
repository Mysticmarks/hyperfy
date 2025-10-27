import { css } from '@firebolt-dev/css'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { MessageSquareTextIcon, RefreshCwIcon, SendHorizonalIcon } from 'lucide-react'

import { AvatarPane } from './AvatarPane'
import { MouseLeftIcon } from './MouseLeftIcon'
import { MouseRightIcon } from './MouseRightIcon'
import { MouseWheelIcon } from './MouseWheelIcon'
import { buttons, propToLabel } from '../../core/extras/buttons'
import { cls, isTouch } from '../utils'
import { ControlPriorities } from '../../core/extras/ControlPriorities'
import { AppsPane } from './AppsPane'
import { MenuMain } from './MenuMain'
import { MenuApp } from './MenuApp'
import { ChevronDoubleUpIcon, HandIcon } from './Icons'
import { Sidebar } from './Sidebar'
import { applyThemeFromPrefs, watchSystemTheme } from './theme'
import { CommandPalette } from './CommandPalette'
import { ShortcutOverlay } from './ShortcutOverlay'
import { HelpCenter } from './HelpCenter'
import { TourGuide } from './TourGuide'
import { matchesBinding } from '../utils/inputBindings'
import { BuilderMotionCanvas } from './BuilderMotionCanvas'

const INSPECTOR_PANES = new Set(['world', 'apps', 'app', 'script', 'nodes', 'meta', 'prefs'])

const TOUR_DEFINITIONS = {
  inspector: {
    id: 'inspector-intro',
    title: 'Inspector walkthrough',
    steps: [
      {
        title: 'Adjust visual styles confidently',
        body: 'Use theme hue sliders and typography scale options to tune accessible palettes. Updated focus rings, hover tokens, and motion preferences instantly preview here.',
        hint: 'Keyboard users can tab through controls. Focus rings stay visible when accessibility focus is enabled.',
      },
      {
        title: 'Motion tokens drive transitions',
        body: 'Inspector panels respect motion tokens—dial in comfortable or reduced motion and the builder UI will adapt easing and timing globally.',
      },
      {
        title: 'Interaction states stay consistent',
        body: 'Buttons, toggles, and dialogs all inherit hover, active, and focus states so creators know when changes are safe to commit.',
      },
    ],
  },
  dialogs: {
    id: 'dialog-tour',
    title: 'Dialog essentials',
    steps: [
      {
        title: 'Accessible dialogs',
        body: 'Dialogs trap focus, honour reduced motion, and expose intent to assistive tech. Confirm prompts announce context and keyboard hints.',
      },
      {
        title: 'Command palette & help',
        body: 'Press Ctrl/Cmd+K to open the command palette, Shift+/ to view contextual help, or Shift+? to show every shortcut overlay.',
      },
    ],
  },
}

const HELP_ARTICLES = [
  {
    id: 'themes-accessibility',
    title: 'Customising themes for accessibility',
    body: 'Use Preferences → Theme to tweak hue, high-contrast mode, typography scale, and motion presets. All inspector and dialog transitions follow these tokens automatically.',
    tags: ['theme', 'accessibility', 'design system'],
    cta: 'Open theme preferences',
    onSelect: world => world.ui.togglePane('prefs'),
  },
  {
    id: 'input-remapping',
    title: 'Remap your input shortcuts',
    body: 'Open Preferences → Controls to bind new shortcuts for menu, command palette, tours, and help. Bindings update live—no reload required.',
    tags: ['keyboard', 'bindings', 'productivity'],
    cta: 'Edit input bindings',
    onSelect: world => world.ui.togglePane('prefs'),
  },
  {
    id: 'guided-tours',
    title: 'Guided tours overview',
    body: 'Tours highlight new creator flows. Restart tours from the command palette by running “Restart onboarding tour”.',
    tags: ['onboarding'],
    cta: 'Start inspector tour',
    onSelect: (_, startTour) => startTour('inspector'),
  },
  {
    id: 'builder-motion',
    title: 'Builder dashboard transitions',
    body: 'The builder dashboard now ships with high-fidelity shader based fades and CSS transforms tuned to stay within 5ms budgets on mid-tier GPUs.',
    tags: ['builder', 'motion'],
  },
]

const HELP_LINKS = [
  {
    title: 'Theme preferences',
    description: 'Jump straight to the theme pane in preferences.',
    onSelect: world => world.ui.togglePane('prefs'),
  },
  {
    title: 'Open inspector',
    description: 'Focus the inspector to edit active entities.',
    onSelect: world => world.ui.togglePane('world'),
  },
  {
    title: 'Restart onboarding tour',
    description: 'Replay the inspector walkthrough from the beginning.',
    onSelect: (_, startTour) => startTour('inspector'),
  },
]

const SHORTCUT_SECTIONS = (bindings = {}) => [
  {
    title: 'Navigation',
    shortcuts: [
      { label: 'Toggle menu', shortcut: bindings.openMenu },
      { label: 'Command palette', shortcut: bindings.openCommandPalette },
      { label: 'Contextual help', shortcut: bindings.openHelp },
    ],
  },
  {
    title: 'Discoverability',
    shortcuts: [
      { label: 'Shortcuts overlay', shortcut: bindings.showShortcuts },
      { label: 'Toggle tours', shortcut: bindings.toggleTours },
    ],
  },
]

export function CoreUI({ world }) {
  const ref = useRef()
  const [ready, setReady] = useState(false)
  const [ui, setUI] = useState(world.ui.state)
  const [confirm, setConfirm] = useState(null)
  const [avatar, setAvatar] = useState(null)
  const [disconnected, setDisconnected] = useState(false)
  const [kicked, setKicked] = useState(null)
  const [appControl, setAppControl] = useState(null)
  const [appsMounted, setAppsMounted] = useState(() => world.ui.state.apps ?? false)
  const [menuMounted, setMenuMounted] = useState(() => Boolean(world.ui.state.menu))
  const [bindings, setBindings] = useState(() => ({ ...world.prefs.inputBindings }))
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [activeTourKey, setActiveTourKey] = useState(null)
  const [tourStep, setTourStep] = useState(0)
  const [textToSpeech, setTextToSpeech] = useState(world.prefs.textToSpeech)
  const [builderActive, setBuilderActive] = useState(world.builder.enabled)
  const [motionModePreference, setMotionModePreference] = useState(world.prefs.motionMode)
  const activeTour = activeTourKey ? TOUR_DEFINITIONS[activeTourKey] : null
  const activeTourStep = activeTour?.steps?.[tourStep]

  const startTour = useCallback(
    key => {
      if (!TOUR_DEFINITIONS[key]) return
      setActiveTourKey(key)
      setTourStep(0)
      const definition = TOUR_DEFINITIONS[key]
      if (!world.prefs.toursSeenSet?.has(definition.id)) {
        world.prefs.markTourSeen(definition.id)
      }
    },
    [world]
  )

  const endTour = useCallback(() => {
    setActiveTourKey(null)
    setTourStep(0)
  }, [])

  const toggleTours = useCallback(() => {
    if (activeTour) {
      endTour()
      return
    }
    startTour('inspector')
  }, [activeTour, startTour, endTour])

  const speak = useCallback(
    text => {
      if (!textToSpeech) return
      if (typeof window === 'undefined' || !window.speechSynthesis || !window.SpeechSynthesisUtterance) return
      const trimmed = (text || '').trim()
      if (!trimmed) return
      try {
        window.speechSynthesis.cancel()
        const utterance = new window.SpeechSynthesisUtterance(trimmed)
        utterance.rate = 1
        window.speechSynthesis.speak(utterance)
      } catch (err) {
        console.warn('speech synthesis unavailable', err)
      }
    },
    [textToSpeech]
  )

  const helpQuickLinks = useMemo(
    () =>
      HELP_LINKS.map(link => ({
        title: link.title,
        description: link.description,
        onSelect: () => {
          link.onSelect(world, startTour)
          setHelpOpen(false)
        },
      })),
    [world, startTour, setHelpOpen]
  )

  const helpArticles = useMemo(
    () =>
      HELP_ARTICLES.map(article => ({
        ...article,
        onSelect: article.onSelect
          ? () => {
              article.onSelect(world, startTour)
              setHelpOpen(false)
            }
          : undefined,
      })),
    [world, startTour, setHelpOpen]
  )

  const commandPaletteCommands = useMemo(
    () => [
      {
        id: 'toggle-menu',
        title: 'Toggle menu',
        description: 'Open or close the core menu overlay.',
        shortcut: bindings.openMenu,
        tags: ['navigation'],
        action: () => world.ui.toggleMenu('main'),
      },
      {
        id: 'open-help',
        title: 'Open help center',
        description: 'Launch contextual help and searchable docs.',
        shortcut: bindings.openHelp,
        tags: ['help', 'documentation'],
        action: () => {
          setHelpOpen(true)
          setCommandPaletteOpen(false)
        },
      },
      {
        id: 'show-shortcuts',
        title: 'Show keyboard shortcuts overlay',
        description: 'Display all remappable shortcuts.',
        shortcut: bindings.showShortcuts,
        tags: ['keyboard'],
        action: () => {
          setShortcutsOpen(true)
          setCommandPaletteOpen(false)
        },
      },
      {
        id: 'start-tour',
        title: activeTour ? 'Close active tour' : 'Start inspector tour',
        description: activeTour
          ? 'Dismiss the currently running tour.'
          : 'Walk through inspector affordances with narrated steps.',
        shortcut: bindings.toggleTours,
        tags: ['onboarding'],
        action: () => {
          if (activeTour) {
            endTour()
          } else {
            startTour('inspector')
          }
        },
      },
    ],
    [bindings, world, activeTour, startTour, endTour]
  )

  const shortcutSections = useMemo(() => SHORTCUT_SECTIONS(bindings), [bindings])

  const handleCommandRun = useCallback(cmd => {
    cmd.action?.()
  }, [])

  const handleTourNext = useCallback(() => {
    if (!activeTour) {
      endTour()
      return
    }
    if (tourStep >= activeTour.steps.length - 1) {
      endTour()
      return
    }
    setTourStep(step => Math.min(activeTour.steps.length - 1, step + 1))
  }, [activeTour, tourStep, endTour])

  const handleTourBack = useCallback(() => {
    if (!activeTour) return
    setTourStep(step => Math.max(0, step - 1))
  }, [activeTour])
  const queuePrefTelemetry = useMemo(() => {
    let pendingKeys = new Set()
    let scheduled = false
    let frameStart = 0
    return keys => {
      if (Array.isArray(keys)) {
        for (const key of keys) {
          if (key) pendingKeys.add(key)
        }
      } else if (keys) {
        pendingKeys.add(keys)
      }
      if (scheduled) return
      scheduled = true
      frameStart = performance.now()
      requestAnimationFrame(() => {
        const duration = performance.now() - frameStart
        const payload = Array.from(pendingKeys)
        pendingKeys = new Set()
        scheduled = false
        if (!payload.length) return
        world.emit('telemetry', {
          source: 'ui',
          event: 'prefs-change-applied',
          keys: payload,
          duration,
        })
      })
    }
  }, [world])
  useEffect(() => {
    world.on('ready', setReady)
    world.on('ui', setUI)
    world.on('confirm', setConfirm)
    world.on('avatar', setAvatar)
    world.on('kick', setKicked)
    world.on('disconnect', setDisconnected)
    const onAppControl = payload => {
      if (payload.state === 'active' && payload.entity) {
        setAppControl({
          entityId: payload.entity.data.id,
          name: payload.entity.blueprint?.name || 'App',
        })
        return
      }
      if (payload.state === 'released') {
        setAppControl(current => {
          if (!current) return null
          if (current.entityId !== payload.entityId) return current
          return null
        })
      }
    }
    world.on('app-control', onAppControl)
    return () => {
      world.off('ready', setReady)
      world.off('ui', setUI)
      world.off('confirm', setConfirm)
      world.off('avatar', setAvatar)
      world.off('kick', setKicked)
      world.off('disconnect', setDisconnected)
      world.off('app-control', onAppControl)
    }
  }, [])

  useEffect(() => {
    if (ui.apps) {
      setAppsMounted(true)
      return
    }
    const timeout = setTimeout(() => setAppsMounted(false), 220)
    return () => clearTimeout(timeout)
  }, [ui.apps])

  useEffect(() => {
    if (ui.menu) {
      setMenuMounted(true)
      return
    }
    const timeout = setTimeout(() => setMenuMounted(false), 220)
    return () => clearTimeout(timeout)
  }, [ui.menu])

  useEffect(() => {
    const elem = ref.current
    const onEvent = e => {
      e.isCoreUI = true
    }
    elem.addEventListener('wheel', onEvent)
    elem.addEventListener('click', onEvent)
    elem.addEventListener('pointerdown', onEvent)
    elem.addEventListener('pointermove', onEvent)
    elem.addEventListener('pointerup', onEvent)
    elem.addEventListener('touchstart', onEvent)
    // elem.addEventListener('touchmove', onEvent)
    // elem.addEventListener('touchend', onEvent)
  }, [])
  useEffect(() => {
    const applyScale = () => {
      document.documentElement.style.fontSize = `${16 * world.prefs.ui}px`
    }
    applyScale()
    function onChange(changes) {
      const keys = Object.keys(changes)
      if (changes.ui) {
        applyScale()
      }
      if (keys.length) {
        queuePrefTelemetry(keys)
      }
    }
    world.prefs.on('change', onChange)
    return () => {
      world.prefs.off('change', onChange)
    }
  }, [world, queuePrefTelemetry])

  useEffect(() => {
    const applyTheme = () => {
      const start = performance.now()
      const { themeMode } = applyThemeFromPrefs(world.prefs)
      requestAnimationFrame(() => {
        const duration = performance.now() - start
        world.emit('telemetry', {
          source: 'ui',
          event: 'theme-applied',
          mode: themeMode,
          duration,
        })
      })
    }
    applyTheme()
    const onChange = changes => {
      if (changes.themeMode || changes.themeHuePrimary || changes.themeHueNeutral) {
        applyTheme()
      }
    }
    const offSystem = watchSystemTheme(() => {
      if (world.prefs.themeMode === 'system') {
        applyTheme()
      }
    })
    world.prefs.on('change', onChange)
    return () => {
      world.prefs.off('change', onChange)
      offSystem()
    }
  }, [world])

  useEffect(() => {
    const onChange = changes => {
      if (changes.inputBindings) {
        setBindings({ ...world.prefs.inputBindings })
      }
      if (changes.textToSpeech) {
        setTextToSpeech(Boolean(changes.textToSpeech.value))
      }
      if (changes.motionMode) {
        setMotionModePreference(changes.motionMode.value)
      }
    }
    world.prefs.on('change', onChange)
    return () => {
      world.prefs.off('change', onChange)
    }
  }, [world])

  useEffect(() => {
    const entries = []
    const onTelemetry = payload => {
      entries.push({ timestamp: Date.now(), ...payload })
      if (entries.length > 250) {
        entries.shift()
      }
    }
    world.on('telemetry', onTelemetry)
    world.telemetry = { entries }
    return () => {
      world.off('telemetry', onTelemetry)
      delete world.telemetry
    }
  }, [world])

  useEffect(() => {
    const onBuildMode = state => {
      setBuilderActive(Boolean(state))
    }
    world.on('build-mode', onBuildMode)
    return () => {
      world.off('build-mode', onBuildMode)
    }
  }, [world])

  useEffect(() => {
    if (!ready) return
    if (activeTourKey) return
    const inspectorTour = TOUR_DEFINITIONS.inspector
    if (ui.active && INSPECTOR_PANES.has(ui.pane) && inspectorTour) {
      if (!world.prefs.toursSeenSet || !world.prefs.toursSeenSet.has(inspectorTour.id)) {
        startTour('inspector')
      }
    }
  }, [ready, ui, activeTourKey, startTour, world])

  useEffect(() => {
    if (!confirm) return
    if (activeTourKey) return
    const dialogTour = TOUR_DEFINITIONS.dialogs
    if (!dialogTour) return
    if (world.prefs.toursSeenSet && world.prefs.toursSeenSet.has(dialogTour.id)) return
    startTour('dialogs')
  }, [confirm, activeTourKey, startTour, world])

  useEffect(() => {
    if (helpOpen) {
      speak('Help center opened. Use the search field to filter tutorials or explore quick links on the right.')
    }
  }, [helpOpen, speak])

  useEffect(() => {
    if (activeTour && activeTourStep) {
      speak(`${activeTour.title}. ${activeTourStep.title}. ${activeTourStep.body}`)
    }
  }, [activeTour, activeTourStep, speak])

  useEffect(() => {
    const handleKeydown = event => {
      if (event.defaultPrevented) return
      const tagName = event.target?.tagName
      if (tagName === 'INPUT' || tagName === 'TEXTAREA') return
      if (matchesBinding(event, bindings.openCommandPalette)) {
        event.preventDefault()
        setCommandPaletteOpen(current => !current)
        setHelpOpen(false)
        setShortcutsOpen(false)
        return
      }
      if (matchesBinding(event, bindings.openHelp)) {
        event.preventDefault()
        setHelpOpen(prev => {
          const next = !prev
          if (!prev) {
            setCommandPaletteOpen(false)
          }
          return next
        })
        return
      }
      if (matchesBinding(event, bindings.showShortcuts)) {
        event.preventDefault()
        setShortcutsOpen(prev => {
          const next = !prev
          if (!prev) {
            setCommandPaletteOpen(false)
          }
          return next
        })
        return
      }
      if (matchesBinding(event, bindings.toggleTours)) {
        event.preventDefault()
        toggleTours()
      }
    }
    window.addEventListener('keydown', handleKeydown)
    return () => window.removeEventListener('keydown', handleKeydown)
  }, [bindings, toggleTours, shortcutsOpen])
  return (
    <div
      ref={ref}
      className='coreui'
      css={css`
        position: absolute;
        inset: 0;
        overflow: hidden;
      `}
    >
      {disconnected && <Disconnected />}
      {!ui.reticleSuppressors && <Reticle world={world} />}
      {<Toast world={world} />}
      <BuilderMotionCanvas active={builderActive && motionModePreference !== 'reduced'} />
      {ready && <ActionsBlock world={world} />}
      {ready && <Sidebar world={world} ui={ui} />}
      {ready && <Chat world={world} />}
      {/* {ready && <Side world={world} player={player} menu={menu} />} */}
      {/* {ready && menu?.type === 'app' && code && (
        <CodeEditor key={`code-${menu.app.data.id}`} world={world} app={menu.app} blur={menu.blur} />
      )} */}
      {avatar && <AvatarPane key={avatar.hash} world={world} info={avatar} />}
      {appsMounted && (
        <div
          className='coreui-appspane'
          css={css`
            position: absolute;
            inset: 0;
            display: flex;
            align-items: flex-start;
            justify-content: flex-start;
            padding: calc(1.5rem + env(safe-area-inset-top)) calc(1.5rem + env(safe-area-inset-right))
              calc(1.5rem + env(safe-area-inset-bottom)) calc(1.5rem + env(safe-area-inset-left));
            pointer-events: ${ui.apps ? 'auto' : 'none'};
            transition: opacity 200ms ease;
            opacity: ${ui.apps ? 1 : 0};
            z-index: 4;
          `}
          aria-hidden={!ui.apps}
          onMouseDown={event => {
            if (event.target === event.currentTarget) {
              world.ui.toggleApps(false)
            }
          }}
        >
          <AppsPane world={world} close={() => world.ui.toggleApps(false)} visible={ui.apps} />
        </div>
      )}
      {!ready && <LoadingOverlay world={world} />}
      {kicked && <KickedOverlay code={kicked} />}
      {ready && isTouch && <TouchBtns world={world} />}
      {ready && isTouch && <TouchStick world={world} />}
      {confirm && <Confirm options={confirm} />}
      {ready && appControl && <AppControlBanner world={world} info={appControl} />}
      {menuMounted && (
        <div
          className='coreui-menu'
          css={css`
            position: absolute;
            inset: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            pointer-events: ${ui.menu ? 'auto' : 'none'};
            z-index: 6;
          `}
          aria-hidden={!ui.menu}
          onMouseDown={event => {
            if (event.target === event.currentTarget) {
              world.ui.setMenu(null)
            }
          }}
        >
          <div
            css={css`
              position: absolute;
              inset: 0;
              background: ${ui.menu ? 'rgba(4, 6, 11, 0.62)' : 'rgba(4, 6, 11, 0)'};
              backdrop-filter: blur(${ui.menu ? '16px' : '0px'});
              transition: opacity 220ms ease, backdrop-filter 220ms ease;
              opacity: ${ui.menu ? 1 : 0};
              pointer-events: none;
            `}
          />
          <div
            css={css`
              position: relative;
              pointer-events: auto;
              opacity: ${ui.menu ? 1 : 0};
              transform: translateY(${ui.menu ? '0' : '8px'});
              transition: opacity 220ms ease, transform 220ms ease;
              max-height: calc(100% - 4rem);
              max-width: min(42rem, calc(100% - 4rem));
            `}
          >
            {ui.menu?.type === 'main' && <MenuMain world={world} page={ui.menu.page} />}
            {ui.menu?.type === 'app' && ui.menu.app && (
              <MenuApp world={world} app={ui.menu.app} blur={ui.menu.blur} />
            )}
          </div>
        </div>
      )}
      <HelpCenter
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        articles={helpArticles}
        quickLinks={helpQuickLinks}
        shortcutBindings={bindings}
      />
      <CommandPalette
        open={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        commands={commandPaletteCommands}
        onRun={handleCommandRun}
      />
      <ShortcutOverlay open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} shortcuts={shortcutSections} />
      <TourGuide tour={activeTour} stepIndex={tourStep} onNext={handleTourNext} onBack={handleTourBack} onDismiss={endTour} />
      <div id='core-ui-portal' />
    </div>
  )
}

function AppControlBanner({ world, info }) {
  const release = () => {
    const entity = world.entities.get(info.entityId)
    entity?.control?.release()
  }
  return (
    <div
      className='app-control-banner'
      css={css`
        position: absolute;
        bottom: calc(1.5rem + env(safe-area-inset-bottom));
        left: 50%;
        transform: translateX(-50%);
        display: flex;
        align-items: center;
        gap: 0.75rem;
        padding: 0.75rem 1.25rem;
        background: var(--hf-color-surface-raised);
        border: 1px solid var(--hf-color-border);
        border-radius: 999px;
        pointer-events: auto;
        box-shadow: var(--hf-shadow-soft);
        font-size: 0.95rem;
        color: var(--hf-color-text);
        button {
          pointer-events: auto;
          border: none;
          border-radius: 999px;
          padding: 0.4rem 0.9rem;
          font-size: 0.9rem;
          font-weight: 500;
          background: var(--hf-color-primary-soft);
          color: var(--hf-color-heading);
          transition: background 0.15s ease, color 0.15s ease;
          &:hover {
            cursor: pointer;
            background: var(--hf-color-primary);
            color: hsl(0 0% 100%);
          }
        }
      `}
    >
      <span>
        {info.name} is using your input. <strong>Release control</strong> when you are finished.
      </span>
      <button type='button' onClick={release}>
        Release
      </button>
    </div>
  )
}

// function Side({ world, menu }) {
//   const inputRef = useRef()
//   const [msg, setMsg] = useState('')
//   const [chat, setChat] = useState(false)
//   const [livekit, setLiveKit] = useState(() => world.livekit.status)
//   const [actions, setActions] = useState(() => world.prefs.actions)
//   useEffect(() => {
//     const onPrefsChange = changes => {
//       if (changes.actions) setActions(changes.actions.value)
//     }
//     const onLiveKitStatus = status => {
//       setLiveKit({ ...status })
//     }
//     world.livekit.on('status', onLiveKitStatus)
//     world.prefs.on('change', onPrefsChange)
//     return () => {
//       world.prefs.off('change', onPrefsChange)
//       world.livekit.off('status', onLiveKitStatus)
//     }
//   }, [])
//   useEffect(() => {
//     const control = world.controls.bind({ priority: ControlPriorities.CORE_UI })
//     control.slash.onPress = () => {
//       if (!chat) setChat(true)
//     }
//     control.enter.onPress = () => {
//       if (!chat) setChat(true)
//     }
//     control.mouseLeft.onPress = () => {
//       if (control.pointer.locked && chat) {
//         setChat(false)
//       }
//     }
//     return () => control.release()
//   }, [chat])
//   useEffect(() => {
//     if (chat) {
//       inputRef.current.focus()
//     } else {
//       inputRef.current.blur()
//     }
//   }, [chat])
//   const send = async e => {
//     if (world.controls.pointer.locked) {
//       setTimeout(() => setChat(false), 10)
//     }
//     if (!msg) {
//       e.preventDefault()
//       return setChat(false)
//     }
//     setMsg('')
//     // check for commands
//     if (msg.startsWith('/')) {
//       world.chat.command(msg)
//       return
//     }
//     // otherwise post it
//     const player = world.entities.player
//     const data = {
//       id: uuid(),
//       from: player.data.name,
//       fromId: player.data.id,
//       body: msg,
//       createdAt: moment().toISOString(),
//     }
//     world.chat.add(data, true)
//     if (isTouch) {
//       e.target.blur()
//       // setTimeout(() => setChat(false), 10)
//     }
//   }
//   return (
//     <div
//       className='side'
//       css={css`
//         position: absolute;
//         top: calc(4rem + env(safe-area-inset-top));
//         left: calc(4rem + env(safe-area-inset-left));
//         bottom: calc(4rem + env(safe-area-inset-bottom));
//         right: calc(4rem + env(safe-area-inset-right));
//         display: flex;
//         align-items: stretch;
//         font-size: 1rem;
//         .side-content {
//           max-width: 21rem;
//           width: 100%;
//           display: flex;
//           flex-direction: column;
//           align-items: stretch;
//         }
//         .side-btns {
//           display: flex;
//           align-items: center;
//           margin-left: -0.5rem;
//         }
//         .side-btn {
//           pointer-events: auto;
//           /* margin-bottom: 1rem; */
//           width: 2.5rem;
//           height: 2.5rem;
//           display: flex;
//           align-items: center;
//           justify-content: center;
//           cursor: pointer;
//           svg {
//             filter: drop-shadow(0 0.0625rem 0.125rem rgba(0, 0, 0, 0.2));
//           }
//         }
//         .side-mid {
//           flex: 1;
//           display: flex;
//           flex-direction: column;
//           justify-content: center;
//         }
//         .side-chatbox {
//           margin-top: 0.5rem;
//           background: rgba(0, 0, 0, 0.3);
//           padding: 0.625rem;
//           display: flex;
//           align-items: center;
//           opacity: 0;
//           &.active {
//             opacity: 1;
//             pointer-events: auto;
//           }
//           &-input {
//             flex: 1;
//             /* paint-order: stroke fill; */
//             /* -webkit-text-stroke: 0.25rem rgba(0, 0, 0, 0.2); */
//             &::placeholder {
//               color: rgba(255, 255, 255, 0.5);
//             }
//           }
//         }
//         @media all and (max-width: 700px), (max-height: 700px) {
//           top: calc(1.5rem + env(safe-area-inset-top));
//           left: calc(1.5rem + env(safe-area-inset-left));
//           bottom: calc(1.5rem + env(safe-area-inset-bottom));
//           right: calc(1.5rem + env(safe-area-inset-right));
//         }
//       `}
//     >
//       <div className='side-content'>
//         <div className='side-btns'>
//           <div className='side-btn' onClick={() => world.ui.toggleMain()}>
//             <MenuIcon size='1.5rem' />
//           </div>
//           {isTouch && (
//             <div
//               className='side-btn'
//               onClick={() => {
//                 console.log('setChat', !chat)
//                 setChat(!chat)
//               }}
//             >
//               <ChatIcon size='1.5rem' />
//             </div>
//           )}
//           {livekit.connected && (
//             <div
//               className='side-btn'
//               onClick={() => {
//                 world.livekit.setMicrophoneEnabled()
//               }}
//             >
//               {livekit.mic ? <MicIcon size='1.5rem' /> : <MicOffIcon size='1.5rem' />}
//             </div>
//           )}
//           {world.xr.supportsVR && (
//             <div
//               className='side-btn'
//               onClick={() => {
//                 world.xr.enter()
//               }}
//             >
//               <VRIcon size='1.5rem' />
//             </div>
//           )}
//         </div>
//         {menu?.type === 'main' && <MenuMain world={world} />}
//         {menu?.type === 'app' && <MenuApp key={menu.app.data.id} world={world} app={menu.app} blur={menu.blur} />}
//         <div className='side-mid'>{!menu && !isTouch && actions && <Actions world={world} />}</div>
//         {isTouch && !chat && <MiniMessages world={world} />}
//         {(isTouch ? chat : true) && <Messages world={world} active={chat || menu} />}
//         <label className={cls('side-chatbox', { active: chat })}>
//           <input
//             ref={inputRef}
//             className='side-chatbox-input'
//             type='text'
//             placeholder='Say something...'
//             value={msg}
//             onChange={e => setMsg(e.target.value)}
//             onKeyDown={e => {
//               if (e.code === 'Escape') {
//                 setChat(false)
//               }
//               // meta quest 3 isn't spec complaint and instead has e.code = '' and e.key = 'Enter'
//               // spec says e.code should be a key code and e.key should be the text output of the key eg 'b', 'B', and '\n'
//               if (e.code === 'Enter' || e.key === 'Enter') {
//                 send(e)
//               }
//             }}
//             onBlur={e => {
//               if (!isTouch) {
//                 setChat(false)
//               }
//             }}
//           />
//         </label>
//       </div>
//     </div>
//   )
// }

function Chat({ world }) {
  const inputRef = useRef()
  const [msg, setMsg] = useState('')
  const [active, setActive] = useState(false)
  useEffect(() => {
    const onToggle = () => {
      setActive(value => !value)
    }
    world.on('sidebar-chat-toggle', onToggle)
    return () => {
      world.off('sidebar-chat-toggle', onToggle)
    }
  }, [])
  useEffect(() => {
    const control = world.controls.bind({ priority: ControlPriorities.CORE_UI })
    control.slash.onPress = () => {
      if (!active) setActive(true)
    }
    control.enter.onPress = () => {
      if (!active) setActive(true)
    }
    control.mouseLeft.onPress = () => {
      if (control.pointer.locked && active) {
        setActive(false)
      }
    }
    return () => control.release()
  }, [active])
  useEffect(() => {
    if (active) {
      inputRef.current.focus()
    } else {
      inputRef.current.blur()
    }
  }, [active])
  const send = async e => {
    if (world.controls.pointer.locked) {
      setTimeout(() => setActive(false), 10)
    }
    if (!msg) {
      e.preventDefault()
      return setActive(false)
    }
    setMsg('')
    // check for commands
    if (msg.startsWith('/')) {
      world.chat.command(msg)
      return
    }
    // otherwise post it
    world.chat.send(msg)
    if (isTouch) {
      // setActive(false)
      e.target.blur()
      setTimeout(() => setActive(false), 10)
    }
  }
  return (
    <div
      className={cls('mainchat', { active })}
      css={css`
        position: absolute;
        left: calc(2rem + env(safe-area-inset-left));
        bottom: calc(2rem + env(safe-area-inset-bottom));
        width: 20rem;
        font-size: 1rem;
        @media all and (max-width: 1200px) {
          left: calc(1rem + env(safe-area-inset-left));
          bottom: calc(1rem + env(safe-area-inset-bottom));
        }
        .mainchat-msgs {
          padding: 0 0 0.5rem 0.4rem;
        }
        .mainchat-btn {
          pointer-events: auto;
          width: 2.875rem;
          height: 2.875rem;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(11, 10, 21, 0.85);
          border: 0.0625rem solid #2a2b39;
          border-radius: 1rem;
          &:hover {
            cursor: pointer;
          }
          opacity: 0; // disabled
        }
        .mainchat-entry {
          height: 2.875rem;
          padding: 0 1rem;
          background: rgba(11, 10, 21, 0.9);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 2rem;
          display: flex;
          align-items: center;

          // debug
          display: none;
          /* pointer-events: auto;
          opacity: 1; */

          input {
            font-size: 0.9375rem;
            line-height: 1;
          }
        }
        .mainchat-send {
          width: 2.875rem;
          height: 2.875rem;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-right: -0.6rem;
        }
        &.active {
          pointer-events: auto;
          .mainchat-btn {
            display: none;
          }
          .mainchat-entry {
            display: flex;
          }
        }
      `}
    >
      <div className='mainchat-msgs'>
        {isTouch && !active && <MiniMessages world={world} />}
        {(!isTouch || active) && <Messages world={world} active={active} />}
      </div>
      <div
        className='mainchat-btn'
        onClick={() => {
          setActive(true)
        }}
      >
        <MessageSquareTextIcon size='1.125rem' />
      </div>
      <label className='mainchat-entry'>
        <input
          ref={inputRef}
          className='side-chatbox-input'
          type='text'
          placeholder='Say something...'
          value={msg}
          onChange={e => setMsg(e.target.value)}
          onKeyDown={e => {
            if (e.code === 'Escape') {
              setActive(false)
            }
            // meta quest 3 isn't spec complaint and instead has e.code = '' and e.key = 'Enter'
            // spec says e.code should be a key code and e.key should be the text output of the key eg 'b', 'B', and '\n'
            if (e.code === 'Enter' || e.key === 'Enter') {
              send(e)
            }
          }}
          onBlur={() => {
            if (!isTouch) {
              setActive(false)
            }
          }}
        />
        {isTouch && (
          <div className='mainchat-send' onClick={e => send(e)}>
            <SendHorizonalIcon size='1.125rem' />
          </div>
        )}
      </label>
    </div>
  )
}

function MiniMessages({ world }) {
  const [msg, setMsg] = useState(null)
  useEffect(() => {
    let init
    return world.chat.subscribe(msgs => {
      if (!init) {
        init = true
        return // skip first
      }
      const msg = msgs[msgs.length - 1]
      if (msg.fromId === world.network.id) return
      setMsg(msg)
    })
  }, [])
  useEffect(() => {
    const timerId = setTimeout(() => {
      setMsg(null)
    }, 4000)
    return () => clearTimeout(timerId)
  }, [msg])
  if (!msg) return null
  return <Message msg={msg} />
}

function Messages({ world, active }) {
  const initRef = useRef()
  const contentRef = useRef()
  const spacerRef = useRef()
  const [msgs, setMsgs] = useState([])
  useEffect(() => {
    return world.chat.subscribe(setMsgs)
  }, [])
  useEffect(() => {
    if (!msgs.length) return
    const didInit = !initRef.current
    if (didInit) {
      spacerRef.current.style.height = contentRef.current.offsetHeight + 'px'
    }
    setTimeout(() => {
      contentRef.current?.scroll({
        top: 9999999,
        behavior: didInit ? 'instant' : 'smooth',
      })
    }, 10)
    initRef.current = true
  }, [msgs])
  useEffect(() => {
    const content = contentRef.current
    // const spacer = spacerRef.current
    // spacer.style.height = content.offsetHeight + 'px'
    const observer = new ResizeObserver(() => {
      contentRef.current?.scroll({
        top: 9999999,
        behavior: 'instant',
      })
    })
    observer.observe(content)
    return () => {
      observer.disconnect()
    }
  }, [])
  return (
    <div
      ref={contentRef}
      className={cls('messages noscrollbar', { active })}
      css={css`
        /* padding: 0 0 0.5rem; */
        /* margin-bottom: 20px; */
        flex: 1;
        max-height: 16rem;
        transition: all 0.15s ease-out;
        display: flex;
        flex-direction: column;
        align-items: stretch;
        overflow-y: auto;
        -webkit-mask-image: linear-gradient(to top, black calc(100% - 10rem), black 10rem, transparent);
        mask-image: linear-gradient(to top, black calc(100% - 10rem), black 10rem, transparent);
        &.active {
          pointer-events: auto;
        }
        .messages-spacer {
          flex-shrink: 0;
        }
      `}
    >
      <div className='messages-spacer' ref={spacerRef} />
      {msgs.map(msg => (
        <Message key={msg.id} msg={msg} />
      ))}
    </div>
  )
}

function Message({ msg }) {
  return (
    <div
      className='message'
      css={css`
        padding: 0.25rem 0;
        line-height: 1.4;
        font-size: 1rem;
        paint-order: stroke fill;
        -webkit-text-stroke: 0.25rem rgba(0, 0, 0, 0.2);
        .message-from {
          margin-right: 0.25rem;
        }
        .message-body {
          // ...
        }
      `}
    >
      {msg.from && <span className='message-from'>[{msg.from}]</span>}
      <span className='message-body'>{msg.body}</span>
      {/* <span>{timeAgo}</span> */}
    </div>
  )
}

function Disconnected() {
  // useEffect(() => {
  //   document.body.style.filter = 'grayscale(100%)'
  //   return () => {
  //     document.body.style.filter = null
  //   }
  // }, [])
  return (
    <>
      <div
        css={css`
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          backdrop-filter: grayscale(100%);
          pointer-events: none;
          z-index: 9999;
          animation: fadeIn 3s forwards;
          @keyframes fadeIn {
            from {
              opacity: 0;
            }
            to {
              opacity: 1;
            }
          }
        `}
      />
      <div
        css={css`
          pointer-events: auto;
          position: absolute;
          top: 50%;
          left: 50%;
          background: rgba(11, 10, 21, 0.85);
          border: 0.0625rem solid #2a2b39;
          backdrop-filter: blur(5px);
          border-radius: 1rem;
          height: 2.75rem;
          padding: 0 1rem;
          transform: translate(-50%, -50%);
          display: flex;
          align-items: center;
          cursor: pointer;
          > span {
            margin-left: 0.4rem;
          }
        `}
        onClick={() => window.location.reload()}
      >
        <RefreshCwIcon size='1.1rem' />
        <span>Reconnect</span>
      </div>
    </>
  )
}

function LoadingOverlay({ world }) {
  const [progress, setProgress] = useState(0)
  const { title, desc, image } = world.settings
  useEffect(() => {
    world.on('progress', setProgress)
    return () => {
      world.off('progress', setProgress)
    }
  }, [])
  return (
    <div
      css={css`
        position: absolute;
        inset: 0;
        background: black;
        display: flex;
        pointer-events: auto;
        @keyframes pulse {
          0% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.05);
          }
          100% {
            transform: scale(1);
          }
        }
        .loading-image {
          position: absolute;
          inset: 0;
          background-position: center;
          background-size: cover;
          background-repeat: no-repeat;
          background-image: ${image ? `url(${world.resolveURL(image.url)})` : 'none'};
          animation: pulse 5s ease-in-out infinite;
        }
        .loading-shade {
          position: absolute;
          inset: 0;
          background: rgba(0, 0, 0, 0.4);
          backdrop-filter: blur(15px);
        }
        .loading-info {
          position: absolute;
          bottom: 50px;
          left: 50px;
          right: 50px;
          max-width: 28rem;
        }
        .loading-title {
          font-size: 2.4rem;
          line-height: 1.2;
          font-weight: 600;
          margin: 0 0 0.5rem;
        }
        .loading-desc {
          color: rgba(255, 255, 255, 0.9);
          font-size: 1rem;
          margin: 0 0 20px;
        }
        .loading-track {
          height: 5px;
          border-radius: 3px;
          background: rgba(255, 255, 255, 0.1);
          position: relative;
        }
        .loading-bar {
          position: absolute;
          top: 0;
          left: 0;
          bottom: 0;
          width: ${progress}%;
          background: white;
          border-radius: 3px;
          transition: width 0.2s ease-out;
        }
      `}
    >
      <div className='loading-image' />
      <div className='loading-shade' />
      <div className='loading-info'>
        {title && <div className='loading-title'>{title}</div>}
        {desc && <div className='loading-desc'>{desc}</div>}
        <div className='loading-track'>
          <div className='loading-bar' />
        </div>
      </div>
    </div>
  )
}

const kickMessages = {
  duplicate_user: 'Player already active on another device or window.',
  player_limit: 'Player limit reached.',
  unknown: 'You were kicked.',
}
function KickedOverlay({ code }) {
  return (
    <div
      css={css`
        position: absolute;
        inset: 0;
        background: black;
        display: flex;
        align-items: center;
        justify-content: center;
        pointer-events: auto;
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
        svg {
          animation: spin 1s linear infinite;
        }
      `}
    >
      <div>{kickMessages[code] || kickMessages.unknown}</div>
    </div>
  )
}

function ActionsBlock({ world }) {
  const [showActions, setShowActions] = useState(() => world.prefs.actions)
  useEffect(() => {
    const onPrefsChange = changes => {
      if (changes.actions) setShowActions(changes.actions.value)
    }
    world.prefs.on('change', onPrefsChange)
    return () => {
      world.prefs.off('change', onPrefsChange)
    }
  }, [])
  if (isTouch) return null
  if (!showActions) return null
  return (
    <div
      css={css`
        position: absolute;
        top: calc(2rem + env(safe-area-inset-top));
        left: calc(2rem + env(safe-area-inset-left));
        bottom: calc(2rem + env(safe-area-inset-bottom));
        display: flex;
        flex-direction: column;
        align-items: center;
        @media all and (max-width: 1200px) {
          top: calc(1rem + env(safe-area-inset-top));
          left: calc(1rem + env(safe-area-inset-left));
          bottom: calc(1rem + env(safe-area-inset-bottom));
        }
      `}
    >
      <Actions world={world} />
    </div>
  )
}

function Actions({ world }) {
  const [actions, setActions] = useState(() => world.controls.actions)
  useEffect(() => {
    world.on('actions', setActions)
    return () => world.off('actions', setActions)
  }, [])
  return (
    <div
      className='actions'
      css={css`
        flex: 1;
        display: flex;
        flex-direction: column;
        justify-content: center;
        .actions-item {
          display: flex;
          align-items: center;
          margin: 0 0 0.5rem;
          &-icon {
            // ...
          }
          &-label {
            margin-left: 0.625em;
            paint-order: stroke fill;
            -webkit-text-stroke: 0.25rem rgba(0, 0, 0, 0.2);
          }
        }
      `}
    >
      {actions.map(action => (
        <div className='actions-item' key={action.id}>
          <div className='actions-item-icon'>{getActionIcon(action)}</div>
          <div className='actions-item-label'>{action.label}</div>
        </div>
      ))}
    </div>
  )
}

function getActionIcon(action) {
  if (action.type === 'custom') {
    return <ActionPill label={action.btn} />
  }
  if (action.type === 'controlLeft') {
    return <ActionPill label='Ctrl' />
  }
  if (action.type === 'mouseLeft') {
    return <ActionIcon icon={MouseLeftIcon} />
  }
  if (action.type === 'mouseRight') {
    return <ActionIcon icon={MouseRightIcon} />
  }
  if (action.type === 'mouseWheel') {
    return <ActionIcon icon={MouseWheelIcon} />
  }
  if (buttons.has(action.type)) {
    return <ActionPill label={propToLabel[action.type]} />
  }
  return <ActionPill label='?' />
}

function ActionPill({ label }) {
  return (
    <div
      className='actionpill'
      css={css`
        border: 0.0625rem solid white;
        border-radius: 0.25rem;
        background: rgba(0, 0, 0, 0.1);
        padding: 0.25rem 0.375rem;
        font-size: 0.875em;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
        paint-order: stroke fill;
        -webkit-text-stroke: 0.25rem rgba(0, 0, 0, 0.2);
      `}
    >
      {label}
    </div>
  )
}

function ActionIcon({ icon: Icon }) {
  return (
    <div
      className='actionicon'
      css={css`
        line-height: 0;
        svg {
          filter: drop-shadow(0 1px 3px rgba(0, 0, 0, 0.8));
        }
      `}
    >
      <Icon size='1.5rem' />
    </div>
  )
}

function Reticle({ world }) {
  const [pointerLocked, setPointerLocked] = useState(world.controls.pointer.locked)
  const [buildMode, setBuildMode] = useState(world.builder.enabled)
  useEffect(() => {
    world.on('pointer-lock', setPointerLocked)
    world.on('build-mode', setBuildMode)
    return () => {
      world.off('pointer-lock', setPointerLocked)
      world.off('build-mode', setBuildMode)
    }
  }, [])
  const visible = isTouch ? true : pointerLocked
  if (!visible) return null
  return (
    <div
      className='reticle'
      css={css`
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 1rem;
        .reticle-item {
          width: 0.25rem;
          height: 0.25rem;
          border-radius: 0.625rem;
          /* border: 0.125rem solid ${buildMode ? '#ff4d4d' : 'white'}; */
          background: ${buildMode ? '#ff4d4d' : 'white'};
          border: 0.5px solid rgba(0, 0, 0, 0.3);
          /* mix-blend-mode: ${buildMode ? 'normal' : 'difference'}; */
        }
      `}
    >
      <div className='reticle-item' />
    </div>
  )
}

function Toast({ world }) {
  const [msg, setMsg] = useState(null)
  useEffect(() => {
    let ids = 0
    const onToast = text => {
      setMsg({ text, id: ++ids })
    }
    world.on('toast', onToast)
    return () => world.off('toast', onToast)
  }, [])
  if (!msg) return null
  return (
    <div
      className='toast'
      css={css`
        position: absolute;
        top: calc(50% - 4.375rem);
        left: 0;
        right: 0;
        display: flex;
        justify-content: center;
        @keyframes toastIn {
          from {
            opacity: 0;
            transform: translateY(10px) scale(0.9);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        .toast-msg {
          height: 2.875rem;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0 1rem;
          background: rgba(11, 10, 21, 0.85);
          border: 0.0625rem solid #2a2b39;
          backdrop-filter: blur(5px);
          border-radius: 1.4375rem;
          opacity: 0;
          transform: translateY(0.625rem) scale(0.9);
          transition: all 0.1s ease-in-out;
          &.visible {
            opacity: 1;
            transform: translateY(0) scale(1);
            animation: toastIn 0.1s ease-in-out;
          }
        }
      `}
    >
      {msg && <ToastMsg key={msg.id} text={msg.text} />}
    </div>
  )
}

function ToastMsg({ text }) {
  const [visible, setVisible] = useState(true)
  useEffect(() => {
    setTimeout(() => setVisible(false), 1000)
  }, [])
  return <div className={cls('toast-msg', { visible })}>{text}</div>
}

function TouchBtns({ world }) {
  const [action, setAction] = useState(world.actions.current.node)
  useEffect(() => {
    function onChange(isAction) {
      setAction(isAction)
    }
    world.actions.on('change', onChange)
    return () => {
      world.actions.off('change', onChange)
    }
  }, [])
  return (
    <div
      className='touchbtns'
      css={css`
        position: absolute;
        top: calc(1.5rem + env(safe-area-inset-top));
        right: calc(1.5rem + env(safe-area-inset-right));
        bottom: calc(1.5rem + env(safe-area-inset-bottom));
        left: calc(1.5rem + env(safe-area-inset-left));
        .touchbtns-btn {
          pointer-events: auto;
          position: absolute;
          /* border: 1px solid rgba(255, 255, 255, 0.1); */
          background: rgba(0, 0, 0, 0.3);
          border-radius: 10rem;
          display: flex;
          align-items: center;
          justify-content: center;
          &.jump {
            width: 4rem;
            height: 4rem;
            bottom: 1rem;
            right: 1rem;
          }
          &.action {
            width: 2.5rem;
            height: 2.5rem;
            bottom: 6rem;
            right: 4rem;
          }
        }
      `}
    >
      {action && (
        <div
          className='touchbtns-btn action'
          onPointerDown={e => {
            e.currentTarget.setPointerCapture(e.pointerId)
            world.controls.setTouchBtn('touchB', true)
          }}
          onPointerLeave={e => {
            world.controls.setTouchBtn('touchB', false)
            e.currentTarget.releasePointerCapture(e.pointerId)
          }}
        >
          <HandIcon size='1.5rem' />
        </div>
      )}
      <div
        className='touchbtns-btn jump'
        onPointerDown={e => {
          e.currentTarget.setPointerCapture(e.pointerId)
          world.controls.setTouchBtn('touchA', true)
        }}
        onPointerLeave={e => {
          world.controls.setTouchBtn('touchA', false)
          e.currentTarget.releasePointerCapture(e.pointerId)
        }}
      >
        <ChevronDoubleUpIcon size='1.5rem' />
      </div>
    </div>
  )
}

function TouchStick({ world }) {
  const outerRef = useRef()
  const innerRef = useRef()
  useEffect(() => {
    const outer = outerRef.current
    const inner = innerRef.current
    function onStick(stick) {
      if (stick) {
        outer.style.left = `${stick.center.x}px`
        outer.style.top = `${stick.center.y}px`
        inner.style.left = `${stick.touch.position.x}px`
        inner.style.top = `${stick.touch.position.y}px`
        inner.style.opacity = 1
      } else {
        inner.style.opacity = 0.1
        const radius = 50 // matches PlayerLocal.js STICK_OUTER_RADIUS
        if (window.innerWidth < window.innerHeight) {
          // portrait
          outer.style.left = `calc(env(safe-area-inset-left) + ${radius}px + 50px)`
          outer.style.top = `calc(100dvh - env(safe-area-inset-bottom) - ${radius}px - 50px)`
          inner.style.left = `calc(env(safe-area-inset-left) + ${radius}px + 50px)`
          inner.style.top = `calc(100dvh - env(safe-area-inset-bottom) - ${radius}px - 50px)`
        } else {
          // landscape
          outer.style.left = `calc(env(safe-area-inset-left) + ${radius}px + 90px)`
          outer.style.top = `calc(100dvh - env(safe-area-inset-bottom) - ${radius}px - 50px)`
          inner.style.left = `calc(env(safe-area-inset-left) + ${radius}px + 90px)`
          inner.style.top = `calc(100dvh - env(safe-area-inset-bottom) - ${radius}px - 50px)`
        }
      }
    }
    onStick(null)
    world.on('stick', onStick)
    return () => {
      world.off('stick', onStick)
    }
  }, [])
  return (
    <div
      className='stick'
      css={css`
        .stick-outer {
          position: absolute;
          width: 100px;
          height: 100px;
          border-radius: 100px;
          background: rgba(0, 0, 0, 0.3);
          transform: translate(-50%, -50%);
        }
        .stick-caret {
          position: absolute;
          width: 20px;
          height: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          &.n {
            top: 0;
            left: 50%;
            transform: translate(-50%, 0);
          }
          &.e {
            top: 50%;
            right: 0;
            transform: translate(0, -50%) rotate(90deg);
          }
          &.s {
            left: 50%;
            bottom: 0;
            transform: translate(-50%, 0) rotate(180deg);
          }
          &.w {
            top: 50%;
            left: 0;
            transform: translate(0, -50%) rotate(-90deg);
          }
        }
        .stick-inner {
          position: absolute;
          width: 50px;
          height: 50px;
          border-radius: 50px;
          background: white;
          transform: translate(-50%, -50%);
        }
      `}
    >
      <div className='stick-outer' ref={outerRef}>
        {/* <div className='stick-caret n'>
          <ChevronUpIcon size={16} />
        </div>
        <div className='stick-caret e'>
          <ChevronUpIcon size={16} />
        </div>
        <div className='stick-caret s'>
          <ChevronUpIcon size={16} />
        </div>
        <div className='stick-caret w'>
          <ChevronUpIcon size={16} />
        </div> */}
      </div>
      <div className='stick-inner' ref={innerRef} />
    </div>
  )
}

function Confirm({ options }) {
  return (
    <div
      className='confirm'
      css={css`
        position: absolute;
        inset: 0;
        padding: 1rem;
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 999;
        .confirm-dialog {
          pointer-events: auto;
          background: rgba(11, 10, 21, 0.9);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 1.375rem;
          backdrop-filter: blur(5px);
          width: 18rem;
        }
        .confirm-content {
          padding: 1.4rem;
        }
        .confirm-title {
          text-align: center;
          font-size: 1.1rem;
          font-weight: 500;
          margin: 0 0 0.7rem;
        }
        .confirm-message {
          text-align: center;
          color: rgba(255, 255, 255, 0.6);
          font-size: 0.9375rem;
          line-height: 1.4;
        }
        .confirm-actions {
          border-top: 1px solid rgba(255, 255, 255, 0.05);
          display: flex;
          align-items: stretch;
        }
        .confirm-action {
          flex: 1;
          min-height: 2.7rem;
          display: flex;
          align-items: center;
          justify-content: center;
          &.left {
            border-right: 1px solid rgba(255, 255, 255, 0.05);
          }
          > span {
            font-size: 0.9375rem;
            color: rgba(255, 255, 255, 0.8);
          }
          &:hover {
            cursor: pointer;
            > span {
              color: white;
            }
          }
        }
      `}
    >
      <div className='confirm-dialog'>
        <div className='confirm-content'>
          <div className='confirm-title'>{options.title}</div>
          <div className='confirm-message'>{options.message}</div>
        </div>
        <div className='confirm-actions'>
          <div className='confirm-action left' onClick={options.confirm}>
            <span>{options.confirmText || 'Okay'}</span>
          </div>
          <div className='confirm-action' onClick={options.cancel}>
            <span>{options.cancelText || 'Cancel'}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
