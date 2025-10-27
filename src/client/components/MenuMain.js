import { useEffect, useMemo, useState } from 'react'
import {
  Menu,
  MenuItemBack,
  MenuItemBtn,
  MenuItemFile,
  MenuItemNumber,
  MenuItemRange,
  MenuSection,
  MenuItemSwitch,
  MenuItemText,
  MenuItemTextarea,
  MenuItemToggle,
  MenuItemStatic,
  MenuItemShortcut,
} from './Menu'
import { usePermissions } from './usePermissions'
import { useFullscreen } from './useFullscreen'
import { STATS_PALETTE_OPTIONS } from '../../core/constants/statsPalettes.js'
import { bindingToHumanReadable } from '../utils/inputBindings'

export function MenuMain({ world, page: initialPage = 'index' }) {
  const [pages, setPages] = useState(() => [initialPage || 'index'])
  useEffect(() => {
    setPages([initialPage || 'index'])
  }, [initialPage])
  const pop = () => {
    const next = pages.slice()
    next.pop()
    setPages(next)
  }
  const push = page => {
    const next = pages.slice()
    next.push(page)
    setPages(next)
  }
  const page = pages[pages.length - 1]
  let Page
  if (page === 'index') Page = MenuMainIndex
  if (page === 'ui') Page = MenuMainUI
  if (page === 'graphics') Page = MenuMainGraphics
  if (page === 'audio') Page = MenuMainAudio
  if (page === 'world') Page = MenuMainWorld
  if (page === 'help') Page = MenuMainHelp
  if (page === 'controls') Page = MenuMainControls
  return <Page world={world} pop={pop} push={push} />
}

function MenuMainIndex({ world, pop, push }) {
  const { isAdmin, isBuilder } = usePermissions(world)
  const player = world.entities.player
  const [name, setName] = useState(() => player.data.name)
  const changeName = name => {
    if (!name) return setName(player.data.name)
    player.modify({ name })
    world.network.send('entityModified', { id: player.data.id, name })
  }
  return (
    <Menu title='Menu'>
      <MenuItemText label='Name' hint='Change your display name' value={name} onChange={changeName} />
      <MenuItemBtn label='UI' hint='Change your interface settings' onClick={() => push('ui')} nav />
      <MenuItemBtn
        label='Controls'
        hint='Remap keyboard shortcuts and toggles'
        onClick={() => push('controls')}
        nav
      />
      <MenuItemBtn label='Graphics' hint='Change your device graphics settings' onClick={() => push('graphics')} nav />
      <MenuItemBtn label='Audio' hint='Change your audio volume' onClick={() => push('audio')} nav />
      <MenuItemBtn
        label='Help & Shortcuts'
        hint='Browse keyboard shortcuts and accessibility tips'
        onClick={() => push('help')}
        nav
      />
      {isBuilder && <MenuItemBtn label='World' hint='Modify world settings' onClick={() => push('world')} nav />}
      {isBuilder && (
        <MenuItemBtn label='Apps' hint='View all apps in the world' onClick={() => world.ui.toggleApps()} />
      )}
    </Menu>
  )
}

function MenuMainUI({ world, pop, push }) {
  const player = world.entities.player
  const [canFullscreen, isFullscreen, toggleFullscreen] = useFullscreen()
  const [ui, setUI] = useState(world.prefs.ui)
  const [actions, setActions] = useState(world.prefs.actions)
  const [stats, setStats] = useState(world.prefs.stats)
  const [statsPalette, setStatsPalette] = useState(world.prefs.statsPalette)
  const [themeMode, setThemeMode] = useState(world.prefs.themeMode)
  const [themeHuePrimary, setThemeHuePrimary] = useState(world.prefs.themeHuePrimary)
  const [themeHueNeutral, setThemeHueNeutral] = useState(world.prefs.themeHueNeutral)
  const [motionMode, setMotionMode] = useState(world.prefs.motionMode)
  const [typographyScale, setTypographyScale] = useState(world.prefs.typographyScale)
  const [highContrast, setHighContrast] = useState(world.prefs.highContrast)
  const [accessibleFocus, setAccessibleFocus] = useState(world.prefs.accessibleFocus)
  const [colorblindFilter, setColorblindFilter] = useState(world.prefs.colorblindFilter)
  const [textToSpeech, setTextToSpeech] = useState(world.prefs.textToSpeech)
  const { isBuilder } = usePermissions(world)
  useEffect(() => {
    const onChange = changes => {
      if (changes.ui) setUI(changes.ui.value)
      if (changes.actions) setActions(changes.actions.value)
      if (changes.stats) setStats(changes.stats.value)
      if (changes.statsPalette) setStatsPalette(changes.statsPalette.value)
      if (changes.themeMode) setThemeMode(changes.themeMode.value)
      if (changes.themeHuePrimary) setThemeHuePrimary(changes.themeHuePrimary.value)
      if (changes.themeHueNeutral) setThemeHueNeutral(changes.themeHueNeutral.value)
      if (changes.motionMode) setMotionMode(changes.motionMode.value)
      if (changes.typographyScale) setTypographyScale(changes.typographyScale.value)
      if (changes.highContrast) setHighContrast(changes.highContrast.value)
      if (changes.accessibleFocus) setAccessibleFocus(changes.accessibleFocus.value)
      if (changes.colorblindFilter) setColorblindFilter(changes.colorblindFilter.value)
      if (changes.textToSpeech) setTextToSpeech(changes.textToSpeech.value)
    }
    world.prefs.on('change', onChange)
    return () => {
      world.prefs.off('change', onChange)
    }
  }, [])
  const motionOptions = useMemo(
    () => [
      { label: 'System', value: 'system' },
      { label: 'Comfortable', value: 'comfortable' },
      { label: 'Reduced', value: 'reduced' },
    ],
    []
  )
  const typographyOptions = useMemo(
    () => [
      { label: 'Standard', value: 'standard' },
      { label: 'Large', value: 'large' },
      { label: 'Extra large', value: 'xlarge' },
    ],
    []
  )
  const colorblindOptions = useMemo(
    () => [
      { label: 'None', value: 'none' },
      { label: 'Protanopia', value: 'protanopia' },
      { label: 'Deuteranopia', value: 'deuteranopia' },
      { label: 'Tritanopia', value: 'tritanopia' },
    ],
    []
  )
  return (
    <Menu title='Menu'>
      <MenuItemBack hint='Go back to the main menu' onClick={pop} />
      <MenuItemToggle
        label='Fullscreen'
        hint='Toggle fullscreen. Not supported in some browsers'
        value={isFullscreen}
        onChange={value => toggleFullscreen(value)}
      />
      <MenuItemRange
        label='UI Scale'
        hint='Change the scale of the user interface'
        min={0.5}
        max={1.5}
        step={0.1}
        value={ui}
        onChange={ui => world.prefs.setUI(ui)}
      />
      <MenuSection label='Appearance' />
      <MenuItemSwitch
        label='Theme Mode'
        hint='Switch between dark, light, or system-controlled theming'
        options={[
          { label: 'System', value: 'system' },
          { label: 'Dark', value: 'dark' },
          { label: 'Light', value: 'light' },
        ]}
        value={themeMode}
        onChange={mode => world.prefs.setThemeMode(mode)}
      />
      <MenuItemRange
        label='Accent Hue'
        hint='Adjust the hue used for highlights and focus states'
        min={0}
        max={360}
        step={1}
        instant
        value={themeHuePrimary}
        onChange={value => world.prefs.setThemeHuePrimary(value)}
      />
      <MenuItemRange
        label='Surface Hue'
        hint='Adjust the base hue used for panels and surfaces'
        min={0}
        max={360}
        step={1}
        instant
        value={themeHueNeutral}
        onChange={value => world.prefs.setThemeHueNeutral(value)}
      />
      <MenuSection label='Motion & Typography' />
      <MenuItemSwitch
        label='Motion preset'
        hint='Adjust easing tokens for inspector, dialogs, and overlays'
        options={motionOptions}
        value={motionMode}
        onChange={value => world.prefs.setMotionMode(value)}
      />
      <MenuItemSwitch
        label='Typography scale'
        hint='Increase base font size for improved readability'
        options={typographyOptions}
        value={typographyScale}
        onChange={value => world.prefs.setTypographyScale(value)}
      />
      <MenuSection label='Accessibility' />
      <MenuItemToggle
        label='High contrast mode'
        hint='Strengthen focus rings, hover states, and text contrast'
        trueLabel='On'
        falseLabel='Off'
        value={highContrast}
        onChange={value => world.prefs.setHighContrast(value)}
      />
      <MenuItemToggle
        label='Persistent focus rings'
        hint='Keeps focus outlines visible for keyboard users'
        trueLabel='Visible'
        falseLabel='Hidden'
        value={accessibleFocus}
        onChange={value => world.prefs.setAccessibleFocus(value)}
      />
      <MenuItemSwitch
        label='Colorblind filter'
        hint='Apply calibrated filters to improve hue separation'
        options={colorblindOptions}
        value={colorblindFilter}
        onChange={value => world.prefs.setColorblindFilter(value)}
      />
      <MenuItemToggle
        label='Text-to-speech guidance'
        hint='Narrate tours and help center announcements using speech synthesis'
        trueLabel='On'
        falseLabel='Off'
        value={textToSpeech}
        onChange={value => world.prefs.setTextToSpeech(value)}
      />
      {isBuilder && (
        <MenuItemToggle
          label='Build Prompts'
          hint='Show or hide action prompts when in build mode'
          value={actions}
          onChange={actions => world.prefs.setActions(actions)}
        />
      )}
      <MenuItemToggle
        label='Stats'
        hint='Show or hide performance stats'
        value={world.prefs.stats}
        onChange={stats => world.prefs.setStats(stats)}
      />
      <MenuItemSwitch
        label='Stats Palette'
        hint='Change the colour palette used by the performance stats overlay'
        options={STATS_PALETTE_OPTIONS}
        value={statsPalette}
        onChange={palette => world.prefs.setStatsPalette(palette)}
      />
    </Menu>
  )
}

function MenuMainControls({ world, pop }) {
  const [bindings, setBindings] = useState({ ...world.prefs.inputBindings })
  useEffect(() => {
    const onChange = changes => {
      if (changes.inputBindings) {
        setBindings({ ...world.prefs.inputBindings })
      }
    }
    world.prefs.on('change', onChange)
    return () => {
      world.prefs.off('change', onChange)
    }
  }, [])
  const shortcutEntries = [
    {
      key: 'openMenu',
      label: 'Toggle menu',
      hint: 'Open or close the creator menu overlay',
    },
    {
      key: 'openCommandPalette',
      label: 'Command palette',
      hint: 'Search for commands, scenes, and onboarding tours',
    },
    {
      key: 'openHelp',
      label: 'Contextual help',
      hint: 'Open the searchable help center',
    },
    {
      key: 'showShortcuts',
      label: 'Keyboard overlay',
      hint: 'Show or hide the global keyboard shortcuts overlay',
    },
    {
      key: 'toggleTours',
      label: 'Toggle tours',
      hint: 'Start or stop the guided tour overlay',
    },
  ]
  return (
    <Menu title='Controls'>
      <MenuItemBack hint='Go back to the main menu' onClick={pop} />
      <MenuSection label='Keyboard shortcuts' />
      {shortcutEntries.map(entry => (
        <MenuItemShortcut
          key={entry.key}
          label={entry.label}
          hint={entry.hint}
          value={bindings[entry.key]}
          onChange={value => world.prefs.setInputBinding(entry.key, value)}
        />
      ))}
      <MenuSection label='Tips' />
      <MenuItemStatic
        label='Reset to default'
        value='While recording, press Backspace to restore the original shortcut.'
      />
      <MenuItemStatic
        label='Current bindings snapshot'
        value={shortcutEntries
          .map(entry => `${entry.label}: ${bindingToHumanReadable(bindings[entry.key])}`)
          .join(' • ')}
      />
    </Menu>
  )
}

function MenuMainHelp({ world, pop }) {
  const bindings = world.prefs.inputBindings
  const shortcuts = [
    { label: 'Toggle menu', value: bindingToHumanReadable(bindings.openMenu) },
    { label: 'Command palette', value: bindingToHumanReadable(bindings.openCommandPalette) },
    { label: 'Help center', value: bindingToHumanReadable(bindings.openHelp) },
    { label: 'Keyboard overlay', value: bindingToHumanReadable(bindings.showShortcuts) },
    { label: 'Toggle tours', value: bindingToHumanReadable(bindings.toggleTours) },
  ]
  return (
    <Menu title='Help & Shortcuts'>
      <MenuItemBack hint='Go back to the main menu' onClick={pop} />
      <MenuSection label='Keyboard shortcuts' />
      {shortcuts.map(item => (
        <MenuItemStatic key={item.label} label={item.label} value={item.value} />
      ))}
      <MenuSection label='Accessibility' />
      <MenuItemStatic
        label='Tours and dialogs'
        value='Guided tours respect reduced motion and announce steps via text-to-speech when enabled.'
      />
      <MenuItemStatic
        label='Tab navigation'
        value='Use Tab and Shift+Tab to move between controls when panes are open. Focus rings stay visible when enabled in Preferences.'
      />
      <MenuItemStatic
        label='Color adjustments'
        value='Set contrast, typography scale, and colorblind filters under Preferences → UI.'
      />
    </Menu>
  )
}

const shadowOptions = [
  { label: 'None', value: 'none' },
  { label: 'Low', value: 'low' },
  { label: 'Med', value: 'med' },
  { label: 'High', value: 'high' },
]
function MenuMainGraphics({ world, pop, push }) {
  const [dpr, setDPR] = useState(world.prefs.dpr)
  const [shadows, setShadows] = useState(world.prefs.shadows)
  const [postprocessing, setPostprocessing] = useState(world.prefs.postprocessing)
  const [bloom, setBloom] = useState(world.prefs.bloom)
  const dprOptions = useMemo(() => {
    const width = world.graphics.width
    const height = world.graphics.height
    const dpr = window.devicePixelRatio
    const options = []
    const add = (label, dpr) => {
      options.push({
        // label: `${Math.round(width * dpr)} x ${Math.round(height * dpr)}`,
        label,
        value: dpr,
      })
    }
    add('0.5x', 0.5)
    add('1x', 1)
    if (dpr >= 2) add('2x', 2)
    if (dpr >= 3) add('3x', dpr)
    return options
  }, [])
  useEffect(() => {
    const onChange = changes => {
      if (changes.dpr) setDPR(changes.dpr.value)
      if (changes.shadows) setShadows(changes.shadows.value)
      if (changes.postprocessing) setPostprocessing(changes.postprocessing.value)
      if (changes.bloom) setBloom(changes.bloom.value)
    }
    world.prefs.on('change', onChange)
    return () => {
      world.prefs.off('change', onChange)
    }
  }, [])
  return (
    <Menu title='Menu'>
      <MenuItemBack hint='Go back to the main menu' onClick={pop} />
      <MenuItemSwitch
        label='Resolution'
        hint='Change your display resolution'
        options={dprOptions}
        value={dpr}
        onChange={dpr => world.prefs.setDPR(dpr)}
      />
      <MenuItemSwitch
        label='Shadows'
        hint='Change the quality of shadows in the world'
        options={shadowOptions}
        value={shadows}
        onChange={shadows => world.prefs.setShadows(shadows)}
      />
      <MenuItemToggle
        label='Postprocessing'
        hint='Enable or disable all postprocessing effects'
        trueLabel='On'
        falseLabel='Off'
        value={postprocessing}
        onChange={postprocessing => world.prefs.setPostprocessing(postprocessing)}
      />
      <MenuItemToggle
        label='Bloom'
        hint='Enable or disable the bloom effect'
        trueLabel='On'
        falseLabel='Off'
        value={bloom}
        onChange={bloom => world.prefs.setBloom(bloom)}
      />
    </Menu>
  )
}

function MenuMainAudio({ world, pop, push }) {
  const [music, setMusic] = useState(world.prefs.music)
  const [sfx, setSFX] = useState(world.prefs.sfx)
  const [voice, setVoice] = useState(world.prefs.voice)
  useEffect(() => {
    const onChange = changes => {
      if (changes.music) setMusic(changes.music.value)
      if (changes.sfx) setSFX(changes.sfx.value)
      if (changes.voice) setVoice(changes.voice.value)
    }
    world.prefs.on('change', onChange)
    return () => {
      world.prefs.off('change', onChange)
    }
  }, [])
  return (
    <Menu title='Menu'>
      <MenuItemBack hint='Go back to the main menu' onClick={pop} />
      <MenuItemRange
        label='Music'
        hint='Adjust general music volume'
        min={0}
        max={2}
        step={0.05}
        value={music}
        onChange={music => world.prefs.setMusic(music)}
      />
      <MenuItemRange
        label='SFX'
        hint='Adjust sound effects volume'
        min={0}
        max={2}
        step={0.05}
        value={sfx}
        onChange={sfx => world.prefs.setSFX(sfx)}
      />
      <MenuItemRange
        label='Voice'
        hint='Adjust global voice chat volume'
        min={0}
        max={2}
        step={0.05}
        value={voice}
        onChange={voice => world.prefs.setVoice(voice)}
      />
    </Menu>
  )
}

function MenuMainWorld({ world, pop, push }) {
  const player = world.entities.player
  const { isAdmin } = usePermissions(world)
  const [title, setTitle] = useState(world.settings.title)
  const [desc, setDesc] = useState(world.settings.desc)
  const [model, setModel] = useState(world.settings.model)
  const [avatar, setAvatar] = useState(world.settings.avatar)
  const [playerLimit, setPlayerLimit] = useState(world.settings.playerLimit)
  const [publicc, setPublic] = useState(world.settings.public)
  useEffect(() => {
    const onChange = changes => {
      if (changes.title) setTitle(changes.title.value)
      if (changes.desc) setDesc(changes.desc.value)
      if (changes.model) setModel(changes.model.value)
      if (changes.avatar) setAvatar(changes.avatar.value)
      if (changes.playerLimit) setPlayerLimit(changes.playerLimit.value)
      if (changes.public) setPublic(changes.public.value)
    }
    world.settings.on('change', onChange)
    return () => {
      world.settings.off('change', onChange)
    }
  }, [])
  return (
    <Menu title='Menu'>
      <MenuItemBack hint='Go back to the main menu' onClick={pop} />
      <MenuItemText
        label='Title'
        hint='Change the title of this world. Shown in the browser tab and when sharing links'
        placeholder='World'
        value={title}
        onChange={value => world.settings.set('title', value, true)}
      />
      <MenuItemText
        label='Description'
        hint='Change the description of this world. Shown in previews when sharing links to this world'
        value={desc}
        onChange={value => world.settings.set('desc', value, true)}
      />
      <MenuItemFile
        label='Environment'
        hint='Change the global environment model'
        kind='model'
        value={model}
        onChange={value => world.settings.set('model', value, true)}
        world={world}
      />
      <MenuItemFile
        label='Avatar'
        hint='Change the default avatar everyone spawns into the world with'
        kind='avatar'
        value={avatar}
        onChange={value => world.settings.set('avatar', value, true)}
        world={world}
      />
      <MenuItemNumber
        label='Player Limit'
        hint='Set a maximum number of players that can be in the world at one time. Zero means unlimited.'
        value={playerLimit}
        onChange={value => world.settings.set('playerLimit', value, true)}
      />
      {isAdmin && (
        <MenuItemToggle
          label='Public'
          hint='Allow everyone to build (and destroy) things in the world. When disabled only admins can build.'
          value={publicc}
          onChange={value => world.settings.set('public', value, true)}
        />
      )}
      <MenuItemBtn
        label='Set Spawn'
        hint='Sets the location players spawn to the location you are currently standing'
        onClick={() => {
          world.network.send('spawnModified', 'set')
        }}
      />
      <MenuItemBtn
        label='Clear Spawn'
        hint='Resets the spawn point to origin'
        onClick={() => {
          world.network.send('spawnModified', 'clear')
        }}
      />
    </Menu>
  )
}
