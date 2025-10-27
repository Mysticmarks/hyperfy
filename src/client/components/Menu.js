import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { css } from '@firebolt-dev/css'
import { ChevronLeftIcon, ChevronRightIcon } from './Icons'
import { useUpdate } from './useUpdate'
import { hashFile } from '../../core/utils-client'
import { LoaderIcon, XIcon } from 'lucide-react'
import { downloadFile } from '../../core/extras/downloadFile'
import { CurvePreview } from './CurvePreview'
import { Curve } from '../../core/extras/Curve'
import { Portal } from './Portal'
import { CurvePane } from './CurvePane'
import { useFocusTrap } from './useFocusTrap'
import { bindingToHumanReadable } from '../utils/inputBindings'

const MenuContext = createContext()

export function Menu({ title, blur, children }) {
  const [hint, setHint] = useState(null)
  const menuRef = useRef(null)
  useFocusTrap(menuRef)
  return (
    <MenuContext.Provider value={setHint}>
      <div
        ref={menuRef}
        className='menu'
        css={css`
        pointer-events: auto;
        display: flex;
        flex-direction: column;
        min-width: 22rem;
        max-height: calc(100vh - 4rem);
        background: var(--hf-color-surface);
        border: 1px solid var(--hf-color-border);
        border-radius: 1rem;
        box-shadow: var(--hf-shadow-hard);
        opacity: ${blur ? 0.35 : 1};
        transition: opacity var(--hf-motion-duration-medium) var(--hf-motion-ease-standard);
        font-size: var(--hf-font-size);
        color: var(--hf-color-text);
        overflow: hidden;
          &:focus-visible {
            outline: 0.2rem solid var(--hf-color-focus);
            outline-offset: 0.15rem;
          }
          .menu-head {
            background: var(--hf-color-surface-raised);
            padding: 1rem 1.25rem;
            white-space: nowrap;
            text-overflow: ellipsis;
            overflow: hidden;
            span {
              font-size: var(--hf-font-title);
              font-weight: 600;
              color: var(--hf-color-heading);
              letter-spacing: 0.01em;
            }
          }
          .menu-items {
            background-color: var(--hf-color-surface);
            overflow-y: auto;
            max-height: calc(2.5rem * 9.5);
            flex: 1 1 auto;
          }
        `}
        role='dialog'
        aria-modal='true'
        tabIndex={-1}
      >
        <div className='menu-head'>
          <span>{title}</span>
        </div>
        <div className='menu-items noscrollbar'>{children}</div>
        {hint && <MenuHint text={hint} />}
      </div>
    </MenuContext.Provider>
  )
}

function MenuHint({ text }) {
  return (
    <div
      className='menuhint'
      css={css`
        margin-top: 0.2rem;
        padding: 0.875rem 1.25rem;
        font-size: var(--hf-font-size-sm);
        line-height: 1.4;
        background-color: var(--hf-color-surface-raised);
        border-top: 0.1rem solid var(--hf-color-border);
        color: var(--hf-color-text-muted);
      `}
    >
      <span>{text}</span>
    </div>
  )
}

export function MenuItemBack({ hint, onClick }) {
  const setHint = useContext(MenuContext)
  return (
    <button
      className='menuback'
      css={css`
        display: flex;
        align-items: center;
        height: 2.5rem;
        padding: 0 1.25rem;
        font-size: var(--hf-font-size);
        background: none;
        border: none;
        width: 100%;
        color: inherit;
        text-align: left;
        > svg {
          margin-left: -0.25rem;
        }
        .menuback-label {
          flex: 1;
        }
        transition: background-color var(--hf-motion-duration-fast) var(--hf-motion-ease-standard),
          color var(--hf-motion-duration-fast) var(--hf-motion-ease-standard);
        &:hover {
          cursor: pointer;
          background: var(--hf-color-interaction-hover);
        }
        &:focus-visible {
          background: var(--hf-color-interaction-hover);
        }
      `}
      onPointerEnter={() => setHint(hint)}
      onPointerLeave={() => setHint(null)}
      onClick={onClick}
      type='button'
    >
      <ChevronLeftIcon size={'1.5rem'} />
      <div className='menuback-label'>
        <span>Back</span>
      </div>
    </button>
  )
}

export function MenuLine() {
  return (
    <div
      className='menuline'
      css={css`
        height: 0.1rem;
        background: var(--hf-color-border);
      `}
    />
  )
}

export function MenuSection({ label }) {
  return (
    <div
      css={css`
        padding: 0.25rem 1.25rem;
        font-size: var(--hf-font-size-sm);
        font-weight: 500;
        color: var(--hf-color-text-muted);
        white-space: nowrap;
        text-overflow: ellipsis;
        overflow: hidden;
      `}
    >
      <span>{label}</span>
    </div>
  )
}

export function MenuItemBtn({ label, hint, nav, onClick }) {
  const setHint = useContext(MenuContext)
  return (
    <button
      className='menuitembtn'
      css={css`
        display: flex;
        align-items: center;
        height: 2.5rem;
        padding: 0 1.25rem;
        .menuitembtn-label {
          flex: 1;
          white-space: nowrap;
          text-overflow: ellipsis;
          overflow: hidden;
        }
        background: none;
        border: none;
        color: inherit;
        text-align: left;
        width: 100%;
        gap: 0.4rem;
        transition: background-color var(--hf-motion-duration-fast) var(--hf-motion-ease-standard);
        &:hover {
          cursor: pointer;
          background: var(--hf-color-interaction-hover);
        }
        &:focus-visible {
          background: var(--hf-color-interaction-hover);
        }
      `}
      onPointerEnter={() => setHint(hint)}
      onPointerLeave={() => setHint(null)}
      onClick={onClick}
      type='button'
    >
      <div className='menuitembtn-label'>{label}</div>
      {nav && <ChevronRightIcon size='1.5rem' />}
    </button>
  )
}

export function MenuItemText({ label, hint, placeholder, value, onChange }) {
  const setHint = useContext(MenuContext)
  const [localValue, setLocalValue] = useState(value)
  useEffect(() => {
    if (localValue !== value) setLocalValue(value)
  }, [value])
  return (
    <label
      className='menuitemtext'
      css={css`
        display: flex;
        align-items: center;
        height: 2.5rem;
        padding: 0 1.25rem;
        cursor: text;
        .menuitemtext-label {
          width: 9.4rem;
          flex-shrink: 0;
          white-space: nowrap;
          text-overflow: ellipsis;
          overflow: hidden;
        }
        .menuitemtext-field {
          flex: 1;
        }
        input {
          text-align: right;
          cursor: inherit;
        }
        &:hover {
          background-color: var(--hf-color-surface-hover);
        }
        &:focus-within {
          background-color: var(--hf-color-surface-hover);
        }
      `}
      onPointerEnter={() => setHint(hint)}
      onPointerLeave={() => setHint(null)}
    >
      <div className='menuitemtext-label'>{label}</div>
      <div className='menuitemtext-field'>
        <input
          type='text'
          value={localValue || ''}
          placeholder={placeholder}
          onFocus={e => e.target.select()}
          onChange={e => setLocalValue(e.target.value)}
          onKeyDown={e => {
            if (e.code === 'Enter') {
              e.preventDefault()
              onChange(localValue)
              e.target.blur()
            }
          }}
          onBlur={e => {
            onChange(localValue)
          }}
        />
      </div>
    </label>
  )
}

export function MenuItemStatic({ label, hint, value }) {
  const setHint = useContext(MenuContext)
  return (
    <div
      className='menuitemstatic'
      css={css`
        display: flex;
        align-items: center;
        height: 2.5rem;
        padding: 0 1.25rem;
        color: var(--hf-color-text-muted);
        .menuitemstatic-label {
          width: 9.4rem;
          flex-shrink: 0;
          white-space: nowrap;
          text-overflow: ellipsis;
          overflow: hidden;
        }
        .menuitemstatic-value {
          flex: 1;
          text-align: right;
          white-space: nowrap;
          text-overflow: ellipsis;
          overflow: hidden;
        }
      `}
      onPointerEnter={() => setHint(hint)}
      onPointerLeave={() => setHint(null)}
    >
      <div className='menuitemstatic-label'>{label}</div>
      <div className='menuitemstatic-value'>{value ?? '—'}</div>
    </div>
  )
}

export function MenuItemTextarea({ label, hint, placeholder, value, onChange }) {
  const setHint = useContext(MenuContext)
  const textareaRef = useRef()
  const [localValue, setLocalValue] = useState(value)
  useEffect(() => {
    if (localValue !== value) setLocalValue(value)
  }, [value])
  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    function update() {
      textarea.style.height = 'auto'
      textarea.style.height = textarea.scrollHeight + 'px'
    }
    update()
    textarea.addEventListener('input', update)
    return () => {
      textarea.removeEventListener('input', update)
    }
  }, [localValue])
  return (
    <label
      className='menuitemtext'
      css={css`
        display: flex;
        align-items: flex-start;
        min-height: 2.5rem;
        padding: 0 1.25rem;
        cursor: text;
        .menuitemtext-label {
          padding-top: 0.6rem;
          width: 9.4rem;
          flex-shrink: 0;
          white-space: nowrap;
          text-overflow: ellipsis;
          overflow: hidden;
        }
        .menuitemtext-field {
          flex: 1;
          padding: 0.6rem 0 0.6rem 0;
        }
        textarea {
          width: 100%;
          height: 1rem;
          text-align: right;
          height: auto;
          overflow: hidden;
          resize: none;
          cursor: inherit;
        }
        &:hover {
          background-color: var(--hf-color-surface-hover);
        }
        &:focus-within {
          background-color: var(--hf-color-surface-hover);
        }
      `}
      onPointerEnter={() => setHint(hint)}
      onPointerLeave={() => setHint(null)}
    >
      <div className='menuitemtext-label'>{label}</div>
      <div className='menuitemtext-field'>
        <textarea
          ref={textareaRef}
          value={localValue || ''}
          placeholder={placeholder}
          onFocus={e => e.target.select()}
          onChange={e => setLocalValue(e.target.value)}
          onKeyDown={e => {
            if (e.metaKey && e.code === 'Enter') {
              e.preventDefault()
              onChange(localValue)
              e.target.blur()
            }
          }}
          onBlur={e => {
            onChange(localValue)
          }}
        />
      </div>
    </label>
  )
}

export function MenuItemNumber({ label, hint, dp = 0, min = -Infinity, max = Infinity, step = 1, value, onChange }) {
  const setHint = useContext(MenuContext)
  if (value === undefined || value === null) {
    value = 0
  }
  const [local, setLocal] = useState(value.toFixed(dp))
  const [focused, setFocused] = useState(false)
  useEffect(() => {
    if (!focused && local !== value.toFixed(dp)) setLocal(value.toFixed(dp))
  }, [focused, value])
  const setTo = str => {
    // try parse math
    let num
    try {
      num = (0, eval)(str)
      if (typeof num !== 'number') {
        throw new Error('input number parse fail')
      }
    } catch (err) {
      console.error(err)
      num = value // revert back to original
    }
    if (num < min || num > max) {
      num = value
    }
    setLocal(num.toFixed(dp))
    onChange(+num.toFixed(dp))
  }
  return (
    <label
      className='menuitemnumber'
      css={css`
        display: flex;
        align-items: center;
        height: 2.5rem;
        padding: 0 1.25rem;
        cursor: text;
        .menuitemnumber-label {
          width: 9.4rem;
          flex-shrink: 0;
          white-space: nowrap;
          text-overflow: ellipsis;
          overflow: hidden;
        }
        .menuitemnumber-field {
          flex: 1;
        }
        input {
          height: 1rem;
          text-align: right;
          overflow: hidden;
          cursor: inherit;
        }
        &:hover {
          cursor: pointer;
          background: var(--hf-color-surface-hover);
        }
        &:focus-within {
          background: var(--hf-color-surface-hover);
        }
      `}
      onPointerEnter={() => setHint(hint)}
      onPointerLeave={() => setHint(null)}
    >
      <div className='menuitemnumber-label'>{label}</div>
      <div className='menuitemnumber-field'>
        <input
          type='text'
          value={local}
          onChange={e => setLocal(e.target.value)}
          onKeyDown={e => {
            if (e.code === 'Enter') {
              e.target.blur()
            }
            if (e.code === 'ArrowUp') {
              setTo(value + step)
            }
            if (e.code === 'ArrowDown') {
              setTo(value - step)
            }
          }}
          onFocus={e => {
            setFocused(true)
            e.target.select()
          }}
          onBlur={e => {
            setFocused(false)
            // if blank, set back to original
            if (local === '') {
              setLocal(value.toFixed(dp))
              return
            }
            // otherwise run through pipeline
            setTo(local)
          }}
        />
      </div>
    </label>
  )
}

export function MenuItemRange({ label, hint, min = 0, max = 1, step = 0.05, instant, value, onChange }) {
  const setHint = useContext(MenuContext)
  const trackRef = useRef()
  if (value === undefined || value === null) {
    value = 0
  }
  const [local, setLocal] = useState(value)
  const [sliding, setSliding] = useState(false)
  useEffect(() => {
    if (!sliding && local !== value) setLocal(value)
  }, [sliding, value])
  useEffect(() => {
    const track = trackRef.current
    if (!track) return
    function calculateValueFromPointer(e, trackElement) {
      const rect = trackElement.getBoundingClientRect()
      const position = (e.clientX - rect.left) / rect.width
      const rawValue = min + position * (max - min)
      // Round to nearest step
      const steppedValue = Math.round(rawValue / step) * step
      // Clamp between min and max
      return Math.max(min, Math.min(max, steppedValue))
    }
    let sliding
    function onPointerDown(e) {
      sliding = true
      setSliding(true)
      const newValue = calculateValueFromPointer(e, e.currentTarget)
      setLocal(newValue)
      if (instant) onChange(newValue)
      e.currentTarget.setPointerCapture(e.pointerId)
    }
    function onPointerMove(e) {
      if (!sliding) return
      const newValue = calculateValueFromPointer(e, e.currentTarget)
      setLocal(newValue)
      if (instant) onChange(newValue)
    }
    function onPointerUp(e) {
      if (!sliding) return
      sliding = false
      setSliding(false)
      const finalValue = calculateValueFromPointer(e, e.currentTarget)
      setLocal(finalValue)
      onChange(finalValue)
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
    track.addEventListener('pointerdown', onPointerDown)
    track.addEventListener('pointermove', onPointerMove)
    track.addEventListener('pointerup', onPointerUp)
    return () => {
      track.removeEventListener('pointerdown', onPointerDown)
      track.removeEventListener('pointermove', onPointerMove)
      track.removeEventListener('pointerup', onPointerUp)
    }
  }, [instant, max, min, step])
  const clampToRange = useMemo(() => {
    return newValue => {
      if (!Number.isFinite(newValue)) return min
      if (max <= min) return min
      const safeStep = step === 0 ? max - min : step
      const steps = Math.round((newValue - min) / safeStep)
      const aligned = min + steps * safeStep
      return Math.max(min, Math.min(max, aligned))
    }
  }, [min, max, step])
  const commitValue = useMemo(() => {
    return nextValue => {
      const aligned = clampToRange(nextValue)
      setLocal(aligned)
      onChange(aligned)
    }
  }, [clampToRange, onChange])
  const handleKeyDown = event => {
    let delta = 0
    if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
      delta = step
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
      delta = -step
    } else if (event.key === 'Home') {
      event.preventDefault()
      commitValue(min)
      return
    } else if (event.key === 'End') {
      event.preventDefault()
      commitValue(max)
      return
    } else if (event.key === 'PageUp') {
      delta = step * 10
    } else if (event.key === 'PageDown') {
      delta = -step * 10
    } else {
      return
    }
    event.preventDefault()
    commitValue(local + delta)
  }
  const alignedLocal = clampToRange(local)
  const range = max - min
  const safeRange = range === 0 ? 1 : range
  const barWidthPercentage = ((alignedLocal - min) / safeRange) * 100 + ''
  const text = useMemo(() => {
    const num = alignedLocal
    const decimalDigits = (num.toString().split('.')[1] || '').length
    if (decimalDigits <= 2) {
      return num.toString()
    }
    return num.toFixed(2)
  }, [alignedLocal])
  return (
    <div
      className='menuitemrange'
      css={css`
        display: flex;
        align-items: center;
        height: 2.5rem;
        padding: 0 1.25rem;
        .menuitemrange-label {
          flex: 1;
          white-space: nowrap;
          text-overflow: ellipsis;
          overflow: hidden;
          padding-right: 1rem;
        }
        .menuitemrange-text {
          font-size: var(--hf-font-size-sm);
          margin-right: 0.5rem;
          opacity: 0;
          color: var(--hf-color-text-muted);
          transition: opacity var(--hf-motion-duration-fast) var(--hf-motion-ease-standard);
        }
        .menuitemrange-track {
          width: 7rem;
          flex-shrink: 0;
          height: 0.5rem;
          border-radius: 0.1rem;
          display: flex;
          align-items: stretch;
          background-color: var(--hf-color-border);
          &:hover {
            cursor: pointer;
          }
        }
        .menuitemrange-bar {
          background-color: var(--hf-color-primary);
          border-radius: 0.1rem;
          width: ${barWidthPercentage}%;
        }
        transition: background-color var(--hf-motion-duration-fast) var(--hf-motion-ease-standard);
        &:hover {
          background-color: var(--hf-color-interaction-hover);
          .menuitemrange-text {
            opacity: 1;
          }
        }
        &:focus-visible {
          background-color: var(--hf-color-interaction-hover);
          .menuitemrange-text {
            opacity: 1;
          }
        }
        &:focus-within {
          background-color: var(--hf-color-interaction-hover);
          .menuitemrange-text {
            opacity: 1;
          }
        }
      `}
      onPointerEnter={() => setHint(hint)}
      onPointerLeave={() => setHint(null)}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role='slider'
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={Number(alignedLocal.toFixed(4))}
      aria-valuetext={text}
      aria-orientation='horizontal'
    >
      <div className='menuitemrange-label'>{label}</div>
      <div className='menuitemrange-text'>{text}</div>
      <div className='menuitemrange-track' ref={trackRef}>
        <div className='menuitemrange-bar' />
      </div>
    </div>
  )
}

export function MenuItemSwitch({ label, hint, options, value, onChange }) {
  options = options || []
  const setHint = useContext(MenuContext)
  const idx = options.findIndex(o => o.value === value)
  const selected = options[idx]
  const prev = () => {
    let nextIdx = idx - 1
    if (nextIdx < 0) nextIdx = options.length - 1
    onChange(options[nextIdx].value)
  }
  const next = () => {
    let nextIdx = idx + 1
    if (nextIdx > options.length - 1) nextIdx = 0
    onChange(options[nextIdx].value)
  }
  const handleKeyDown = e => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault()
      prev()
    }
    if (e.key === 'ArrowRight') {
      e.preventDefault()
      next()
    }
  }
  return (
    <div
      className='menuitemswitch'
      css={css`
        display: flex;
        align-items: center;
        height: 2.5rem;
        padding: 0 1.25rem;
        .menuitemswitch-label {
          flex: 1;
          white-space: nowrap;
          text-overflow: ellipsis;
          overflow: hidden;
          padding-right: 1rem;
        }
          .menuitemswitch-btn {
            width: 2.125rem;
            height: 2.125rem;
            display: none;
            align-items: center;
            justify-content: center;
            opacity: 0.2;
            background: none;
            border: none;
            color: var(--hf-color-text-muted);
            &:hover {
              cursor: pointer;
              opacity: 1;
              color: var(--hf-color-heading);
            }
          }
          .menuitemswitch-text {
            line-height: 1;
          }
        &:hover,
        &:focus-within {
          padding: 0 0.275rem 0 0.875rem;
          background-color: var(--hf-color-surface-hover);
          .menuitemswitch-btn {
            display: flex;
          }
        }
      `}
      onPointerEnter={() => setHint(hint)}
      onPointerLeave={() => setHint(null)}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role='group'
      aria-label={label}
    >
      <div className='menuitemswitch-label'>{label}</div>
      <button className='menuitemswitch-btn left' type='button' onClick={prev} aria-label='Previous option'>
        <ChevronLeftIcon size='1.5rem' />
      </button>
      <div className='menuitemswitch-text'>{selected?.label || '???'}</div>
      <button className='menuitemswitch-btn right' type='button' onClick={next} aria-label='Next option'>
        <ChevronRightIcon size='1.5rem' />
      </button>
    </div>
  )
}

export function MenuItemCurve({ label, hint, x, xRange, y, yMin, yMax, value, onChange }) {
  const setHint = useContext(MenuContext)
  const curve = useMemo(() => new Curve().deserialize(value || '0,0.5,0,0|1,0.5,0,0'), [value])
  const [edit, setEdit] = useState(false)
  return (
    <div
      className='menuitemcurve'
      css={css`
        .menuitemcurve-control {
          display: flex;
          align-items: center;
          height: 2.5rem;
          padding: 0 1.25rem;
        }
        .menuitemcurve-label {
          flex: 1;
          white-space: nowrap;
          text-overflow: ellipsis;
          overflow: hidden;
          padding-right: 1rem;
        }
        .menuitemcurve-curve {
          width: 6rem;
          height: 1.2rem;
          position: relative;
        }
        &:hover {
          cursor: pointer;
          background-color: var(--hf-color-surface-hover);
        }
      `}
    >
      <div
        className='menuitemcurve-control'
        onClick={() => {
          if (edit) {
            setEdit(null)
          } else {
            setEdit(curve.clone())
          }
        }}
        onPointerEnter={() => setHint(hint)}
        onPointerLeave={() => setHint(null)}
      >
        <div className='menuitemcurve-label'>{label}</div>
        <div className='menuitemcurve-curve'>
          <CurvePreview curve={curve} yMin={yMin} yMax={yMax} />
        </div>
      </div>
      {edit && (
        <Portal>
          <CurvePane
            curve={edit}
            title={label}
            xLabel={x}
            xRange={xRange}
            yLabel={y}
            yMin={yMin}
            yMax={yMax}
            onCommit={() => {
              onChange(edit.serialize())
              setEdit(null)
            }}
            onCancel={() => {
              setEdit(null)
            }}
          />
        </Portal>
      )}
    </div>
  )
}

// todo: blueprint models need migrating to file object format so
// we can replace needing this and instead use MenuItemFile, but
// that will also somehow need to support both model and avatar kinds.
export function MenuItemFileBtn({ label, hint, accept, value, onChange }) {
  const setHint = useContext(MenuContext)
  const [key, setKey] = useState(0)
  const handleDownload = e => {
    if (e.shiftKey) {
      e.preventDefault()
      const file = world.loader.getFile(value)
      if (!file) return
      downloadFile(file)
    }
  }
  const handleChange = e => {
    setKey(n => n + 1)
    onChange(e.target.files[0])
  }
  return (
    <label
      className='menuitemfilebtn'
      css={css`
        display: flex;
        align-items: center;
        height: 2.5rem;
        padding: 0 1.25rem;
        overflow: hidden;
        .menuitemfilebtn-label {
          width: 9.4rem;
          flex-shrink: 0;
        }
        input {
          position: absolute;
          top: -9999px;
        }
        &:hover {
          cursor: pointer;
          background: var(--hf-color-surface-hover);
        }
        &:focus-within {
          background: var(--hf-color-surface-hover);
        }
      `}
      onPointerEnter={() => setHint(hint)}
      onPointerLeave={() => setHint(null)}
      onClick={handleDownload}
    >
      <div className='menuitemfilebtn-label'>{label}</div>
      <input key={key} type='file' accept={accept} onChange={handleChange} />
    </label>
  )
}

export const fileKinds = {
  avatar: {
    type: 'avatar',
    accept: '.vrm',
    exts: ['vrm'],
    placeholder: 'vrm',
  },
  emote: {
    type: 'emote',
    accept: '.glb',
    exts: ['glb'],
    placeholder: 'glb',
  },
  model: {
    type: 'model',
    accept: '.glb',
    exts: ['glb'],
    placeholder: 'glb',
  },
  texture: {
    type: 'texture',
    accept: '.jpg,.jpeg,.png,.webp',
    exts: ['jpg', 'jpeg', 'png', 'webp'],
    placeholder: 'jpg,png,webp',
  },
  image: {
    type: 'image',
    accept: '.jpg,.jpeg,.png,.webp',
    exts: ['jpg', 'jpeg', 'png', 'webp'],
    placeholder: 'jpg,png,webp',
  },
  video: {
    type: 'video',
    accept: '.mp4',
    exts: ['mp4'],
    placeholder: 'mp4',
  },
  hdr: {
    type: 'hdr',
    accept: '.hdr',
    exts: ['hdr'],
    placeholder: 'hdr',
  },
  audio: {
    type: 'audio',
    accept: '.mp3',
    exts: ['mp3'],
    placeholder: 'mp3',
  },
}

export function MenuItemFile({ world, label, hint, kind: kindName, value, onChange }) {
  const setHint = useContext(MenuContext)
  const nRef = useRef(0)
  const update = useUpdate()
  const [loading, setLoading] = useState(null)
  const kind = fileKinds[kindName]
  if (!kind) return null // invalid?
  const set = async e => {
    // trigger input rebuild
    const n = ++nRef.current
    update()
    // get file
    const file = e.target.files[0]
    if (!file) return
    // check ext
    const ext = file.name.split('.').pop().toLowerCase()
    if (!kind.exts.includes(ext)) {
      return console.error(`attempted invalid file extension for ${kindName}: ${ext}`)
    }
    // immutable hash the file
    const hash = await hashFile(file)
    // use hash as glb filename
    const filename = `${hash}.${ext}`
    // canonical url to this file
    const url = `asset://${filename}`
    // show loading
    const newValue = {
      type: kind.type,
      name: file.name,
      url,
    }
    setLoading(newValue)
    // upload file
    await world.network.upload(file)
    // ignore if new value/upload
    if (nRef.current !== n) return
    // cache file locally so this client can insta-load it
    world.loader.insert(kind.type, url, file)
    // apply!
    setLoading(null)
    onChange(newValue)
  }
  const remove = e => {
    e.preventDefault()
    e.stopPropagation()
    onChange(null)
  }
  const handleDownload = e => {
    if (e.shiftKey && value?.url) {
      e.preventDefault()
      const file = world.loader.getFile(value.url, value.name)
      if (!file) return
      downloadFile(file)
    }
  }
  const n = nRef.current
  const name = loading?.name || value?.name
  return (
    <label
      className='menuitemfile'
      css={css`
        display: flex;
        align-items: center;
        height: 2.5rem;
        padding: 0 1.25rem;
        overflow: hidden;
        input {
          position: absolute;
          top: -9999px;
          left: -9999px;
          opacity: 0;
        }
        svg {
          line-height: 0;
        }
        .menuitemfile-label {
          flex: 1;
          white-space: nowrap;
          text-overflow: ellipsis;
          overflow: hidden;
          padding-right: 1rem;
        }
        .menuitemfile-placeholder {
          color: var(--hf-color-text-muted);
        }
        .menuitemfile-name {
          text-align: right;
          white-space: nowrap;
          text-overflow: ellipsis;
          overflow: hidden;
          max-width: 9rem;
        }
        .menuitemfile-x {
          line-height: 0;
          margin: 0 -0.2rem 0 0.3rem;
          color: var(--hf-color-text-muted);
          &:hover {
            color: var(--hf-color-heading);
          }
        }
        .menuitemfile-loading {
          margin: 0 -0.1rem 0 0.3rem;
          display: flex;
          align-items: center;
          justify-content: center;
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
        }
        &:hover {
          cursor: pointer;
          background: var(--hf-color-surface-hover);
        }
        &:focus-within {
          background: var(--hf-color-surface-hover);
        }
      `}
      onPointerEnter={() => setHint(hint)}
      onPointerLeave={() => setHint(null)}
      onClick={handleDownload}
    >
      <div className='menuitemfile-label'>{label}</div>
      {!value && !loading && <div className='menuitemfile-placeholder'>{kind.placeholder}</div>}
      {name && <div className='menuitemfile-name'>{name}</div>}
      {value && !loading && (
        <div className='menuitemfile-x'>
          <XIcon size='1rem' onClick={remove} />
        </div>
      )}
      {loading && (
        <div className='menuitemfile-loading'>
          <LoaderIcon size='1rem' />
        </div>
      )}
      <input key={n} type='file' onChange={set} accept={kind.accept} />
    </label>
  )
}

export function MenuItemToggle({ label, hint, trueLabel = 'Yes', falseLabel = 'No', value, onChange }) {
  const setHint = useContext(MenuContext)
  return (
    <button
      className='menuitemtoggle'
      css={css`
        display: flex;
        align-items: center;
        height: 2.5rem;
        padding: 0 1.25rem;
        width: 100%;
        background: none;
        border: none;
        color: inherit;
        text-align: left;
        transition: background-color var(--hf-motion-duration-fast) var(--hf-motion-ease-standard),
          color var(--hf-motion-duration-fast) var(--hf-motion-ease-standard);
        .menuitemtoggle-label {
          flex: 1;
          white-space: nowrap;
          text-overflow: ellipsis;
          overflow: hidden;
          padding-right: 1rem;
        }
        .menuitemtoggle-text {
          font-weight: 500;
          min-width: 4rem;
          text-align: right;
          color: ${value ? 'var(--hf-color-primary)' : 'var(--hf-color-text-muted)'};
        }
        &:hover,
        &:focus-visible {
          cursor: pointer;
          background: var(--hf-color-interaction-hover);
        }
      `}
      onPointerEnter={() => setHint(hint)}
      onPointerLeave={() => setHint(null)}
      onClick={() => onChange(!value)}
      type='button'
      aria-pressed={Boolean(value)}
    >
      <div className='menuitemtoggle-label'>{label}</div>
      <div className='menuitemtoggle-text'>{value ? trueLabel : falseLabel}</div>
    </button>
  )
}

export function MenuItemShortcut({ label, hint, value, onChange }) {
  const setHint = useContext(MenuContext)
  const [recording, setRecording] = useState(false)
  const [display, setDisplay] = useState(value)
  const [error, setError] = useState(null)
  useEffect(() => {
    setDisplay(value)
    setError(null)
  }, [value])
  useEffect(() => {
    if (!recording) return
    const handle = event => {
      event.preventDefault()
      event.stopPropagation()
      if (event.key === 'Escape') {
        setRecording(false)
        return
      }
      if (event.key === 'Backspace' || event.key === 'Delete') {
        setRecording(false)
        onChange('')
        return
      }
      const parts = []
      const isMac = typeof navigator !== 'undefined' && /Mac/.test(navigator.platform)
      if (event.metaKey || (!isMac && event.ctrlKey)) {
        parts.push(isMac ? 'cmd' : 'ctrl')
      } else if (event.ctrlKey) {
        parts.push('ctrl')
      }
      if (event.altKey) parts.push('alt')
      if (event.shiftKey) parts.push('shift')
      const key = resolveShortcutKey(event)
      if (!key) {
        setError('Unsupported key — try letters, numbers, arrows, or F-keys.')
        return
      }
      setError(null)
      parts.push(key)
      const shortcut = parts.join('+')
      if (shortcut) {
        onChange(shortcut)
        setDisplay(shortcut)
        setRecording(false)
      }
    }
    const handleBlur = () => {
      setRecording(false)
    }
    window.addEventListener('keydown', handle, true)
    window.addEventListener('blur', handleBlur)
    return () => {
      window.removeEventListener('keydown', handle, true)
      window.removeEventListener('blur', handleBlur)
    }
  }, [recording, onChange])
  const text = recording ? error || 'Press keys…' : bindingToHumanReadable(display) || 'Not set'
  return (
    <button
      className='menuitemshortcut'
      css={css`
        display: flex;
        align-items: center;
        height: 2.5rem;
        padding: 0 1.25rem;
        width: 100%;
        background: none;
        border: none;
        color: inherit;
        text-align: left;
        cursor: pointer;
        transition: background-color var(--hf-motion-duration-fast) var(--hf-motion-ease-standard);
        .menuitemshortcut-label {
          flex: 1;
          white-space: nowrap;
          text-overflow: ellipsis;
          overflow: hidden;
          padding-right: 1rem;
        }
        .menuitemshortcut-value {
          font-size: var(--hf-font-size-sm);
          color: ${recording
            ? error
              ? 'var(--hf-color-text)'
              : 'var(--hf-color-primary)'
            : 'var(--hf-color-text-muted)'};
          ${error ? 'font-style: italic;' : ''}
        }
        &:hover,
        &:focus-visible {
          background: var(--hf-color-interaction-hover);
        }
      `}
      onPointerEnter={() => setHint(hint)}
      onPointerLeave={() => setHint(null)}
      onClick={() => {
        setRecording(true)
        setError(null)
      }}
      type='button'
      aria-pressed={recording}
    >
      <div className='menuitemshortcut-label'>{label}</div>
      <div className='menuitemshortcut-value'>{text}</div>
    </button>
  )
}

const MODIFIER_KEYS = new Set(['control', 'shift', 'meta', 'alt', 'os', 'hyper', 'super', 'fn'])
const NAMED_KEY_ALIASES = new Map([
  [' ', 'space'],
  ['spacebar', 'space'],
  ['escape', 'escape'],
  ['esc', 'escape'],
])
const SUPPORTED_NAMED_KEYS = new Set([
  'enter',
  'tab',
  'escape',
  'space',
  'arrowup',
  'arrowdown',
  'arrowleft',
  'arrowright',
  'home',
  'end',
  'pageup',
  'pagedown',
  'insert',
  'delete',
])

function resolveShortcutKey(event) {
  const fromCode = normalizeCode(event.code)
  if (fromCode) return fromCode
  let key = (event.key || '').toLowerCase()
  if (NAMED_KEY_ALIASES.has(key)) {
    key = NAMED_KEY_ALIASES.get(key)
  }
  if (!key || MODIFIER_KEYS.has(key) || key === 'dead' || key === 'unidentified') {
    return null
  }
  if (SUPPORTED_NAMED_KEYS.has(key)) {
    return key
  }
  if (/^f(1[0-2]|[1-9])$/.test(key)) {
    return key
  }
  if (key.length === 1) {
    return key
  }
  return null
}

const CODE_KEY_ALIASES = new Map([
  ['KeyA', 'a'],
  ['KeyB', 'b'],
  ['KeyC', 'c'],
  ['KeyD', 'd'],
  ['KeyE', 'e'],
  ['KeyF', 'f'],
  ['KeyG', 'g'],
  ['KeyH', 'h'],
  ['KeyI', 'i'],
  ['KeyJ', 'j'],
  ['KeyK', 'k'],
  ['KeyL', 'l'],
  ['KeyM', 'm'],
  ['KeyN', 'n'],
  ['KeyO', 'o'],
  ['KeyP', 'p'],
  ['KeyQ', 'q'],
  ['KeyR', 'r'],
  ['KeyS', 's'],
  ['KeyT', 't'],
  ['KeyU', 'u'],
  ['KeyV', 'v'],
  ['KeyW', 'w'],
  ['KeyX', 'x'],
  ['KeyY', 'y'],
  ['KeyZ', 'z'],
  ['Digit0', '0'],
  ['Digit1', '1'],
  ['Digit2', '2'],
  ['Digit3', '3'],
  ['Digit4', '4'],
  ['Digit5', '5'],
  ['Digit6', '6'],
  ['Digit7', '7'],
  ['Digit8', '8'],
  ['Digit9', '9'],
  ['Backquote', '`'],
  ['Minus', '-'],
  ['Equal', '='],
  ['BracketLeft', '['],
  ['BracketRight', ']'],
  ['Backslash', '\\'],
  ['Semicolon', ';'],
  ['Quote', "'"],
  ['Comma', ','],
  ['Period', '.'],
  ['Slash', '/'],
  ['NumpadDivide', '/'],
  ['NumpadMultiply', '*'],
  ['NumpadSubtract', '-'],
  ['NumpadAdd', '+'],
  ['NumpadDecimal', '.'],
  ['NumpadEnter', 'enter'],
  ['Numpad0', '0'],
  ['Numpad1', '1'],
  ['Numpad2', '2'],
  ['Numpad3', '3'],
  ['Numpad4', '4'],
  ['Numpad5', '5'],
  ['Numpad6', '6'],
  ['Numpad7', '7'],
  ['Numpad8', '8'],
  ['Numpad9', '9'],
  ['Space', 'space'],
  ['Enter', 'enter'],
  ['Tab', 'tab'],
  ['Escape', 'escape'],
  ['ArrowUp', 'arrowup'],
  ['ArrowDown', 'arrowdown'],
  ['ArrowLeft', 'arrowleft'],
  ['ArrowRight', 'arrowright'],
  ['Home', 'home'],
  ['End', 'end'],
  ['PageUp', 'pageup'],
  ['PageDown', 'pagedown'],
  ['Insert', 'insert'],
  ['Delete', 'delete'],
])

function normalizeCode(code) {
  if (!code) return null
  if (CODE_KEY_ALIASES.has(code)) {
    return CODE_KEY_ALIASES.get(code)
  }
  if (code.startsWith('F')) {
    const upper = code.toUpperCase()
    if (/^F(1[0-2]|[1-9])$/.test(upper)) {
      return upper.toLowerCase()
    }
  }
  return null
}
