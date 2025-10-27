import { css } from '@firebolt-dev/css'
import { useEffect, useMemo, useRef, useState } from 'react'

import { bindingToHumanReadable } from '../utils/inputBindings'
import { Portal } from './Portal'
import { useFocusTrap } from './useFocusTrap'
import { highlightMatch, scoreCommands } from './commandPaletteUtils'

export function CommandPalette({ open, onClose, commands = [], onRun }) {
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)
  const listRef = useRef(null)
  const inputRef = useRef(null)
  useFocusTrap(listRef, { active: open })

  useEffect(() => {
    if (!open) {
      setQuery('')
      setActiveIndex(0)
      return
    }
    const timeout = setTimeout(() => {
      inputRef.current?.focus()
      inputRef.current?.select()
    }, 16)
    return () => clearTimeout(timeout)
  }, [open])

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setPrefersReducedMotion(mediaQuery.matches)
    update()
    mediaQuery.addEventListener('change', update)
    return () => mediaQuery.removeEventListener('change', update)
  }, [])

  const scored = useMemo(() => scoreCommands(commands, query), [commands, query])

  const filteredFlat = useMemo(() => scored.map(entry => entry.command), [scored])

  const grouped = useMemo(() => {
    if (filteredFlat.length === 0) return []
    const groups = new Map()
    for (const command of filteredFlat) {
      const groupName = command.group ?? 'Commands'
      if (!groups.has(groupName)) {
        groups.set(groupName, [])
      }
      groups.get(groupName).push(command)
    }
    return Array.from(groups.entries()).map(([name, items]) => ({ name, items }))
  }, [filteredFlat])

  useEffect(() => {
    setActiveIndex(0)
  }, [grouped.length, query])

  useEffect(() => {
    if (!open) return
    const handleKeyDown = event => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose?.()
      } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault()
        setActiveIndex(current => {
          const next = event.key === 'ArrowDown' ? current + 1 : current - 1
          if (next < 0) return Math.max(filteredFlat.length - 1, 0)
          if (next >= filteredFlat.length) return 0
          return next
        })
      } else if (event.key === 'Enter') {
        const active = filteredFlat[activeIndex]
        if (active) {
          onRun?.(active)
          onClose?.()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activeIndex, filteredFlat, onClose, onRun, open])

  if (!open) return null

  const animationStyles = prefersReducedMotion
    ? ''
    : `
        transform: translateY(-8px);
        opacity: 0;
        animation: commandpalette-enter 150ms var(--hf-motion-ease-emphasized) forwards;

        @keyframes commandpalette-enter {
          from {
            transform: translateY(-8px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
      `

  return (
    <Portal>
      <div
        role='presentation'
        className='commandpalette-backdrop'
        css={css`
          position: fixed;
          inset: 0;
          display: flex;
          align-items: flex-start;
          justify-content: center;
          background: rgba(10, 11, 24, 0.56);
          backdrop-filter: blur(0.6rem);
          z-index: 40;
        `}
        onClick={event => {
          if (event.target === event.currentTarget) {
            onClose?.()
          }
        }}
      >
        <div
          ref={listRef}
          role='dialog'
          aria-modal='true'
          aria-label='Command palette'
          className='commandpalette'
          css={css`
            margin-top: min(15vh, 8rem);
            width: min(40rem, calc(100vw - 3rem));
            background: var(--hf-color-surface);
            border-radius: 1rem;
            border: 1px solid var(--hf-color-border);
            box-shadow: var(--hf-shadow-soft);
            display: flex;
            flex-direction: column;
            overflow: hidden;
            ${animationStyles}
          `}
        >
          <label
            css={css`
              display: flex;
              align-items: center;
              gap: 0.75rem;
              padding: 1rem 1.25rem;
              border-bottom: 1px solid var(--hf-color-border);
              background: var(--hf-color-surface-raised);
            `}
          >
            <span
              css={css`
                font-size: var(--hf-font-size-sm);
                text-transform: uppercase;
                color: var(--hf-color-text-muted);
                letter-spacing: 0.08em;
              `}
            >
              Search
            </span>
            <input
              ref={inputRef}
              aria-label='Search commands'
              value={query}
              onChange={event => setQuery(event.target.value)}
              onKeyDown={event => {
                if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                  event.preventDefault()
                  setActiveIndex(current => {
                    const next = event.key === 'ArrowDown' ? current + 1 : current - 1
                    if (next < 0) return Math.max(filteredFlat.length - 1, 0)
                    if (next >= filteredFlat.length) return 0
                    return next
                  })
                } else if (event.key === 'Enter') {
                  const active = filteredFlat[activeIndex]
                  if (active) {
                    onRun?.(active)
                    onClose?.()
                  }
                }
              }}
              placeholder='Type to filter commands'
              css={css`
                flex: 1;
                font-size: var(--hf-font-size);
                color: var(--hf-color-text);
                background: transparent;
              `}
            />
          </label>
          <ul
            className='commandpalette-list noscrollbar'
            css={css`
              list-style: none;
              margin: 0;
              padding: 0;
              max-height: min(22rem, 60vh);
              overflow-y: auto;
            `}
          >
            {filteredFlat.length === 0 && (
              <li
                css={css`
                  padding: 1.5rem 1.25rem;
                  color: var(--hf-color-text-muted);
                  font-size: var(--hf-font-size);
                `}
              >
                No commands match “{query}”.
              </li>
            )}
            {grouped.map(group => (
              <li key={group.name}>
                <div
                  css={css`
                    padding: 0.75rem 1.25rem 0.25rem;
                    font-size: var(--hf-font-size-xs);
                    letter-spacing: 0.08em;
                    text-transform: uppercase;
                    color: var(--hf-color-text-muted);
                  `}
                >
                  {group.name}
                </div>
                <ul
                  css={css`
                    list-style: none;
                    margin: 0;
                    padding: 0;
                  `}
                >
                  {group.items.map(command => {
                    const flatIndex = filteredFlat.indexOf(command)
                    const isActive = flatIndex === activeIndex
                    return (
                      <li key={command.id}>
                        <button
                          type='button'
                          onMouseEnter={() => setActiveIndex(flatIndex)}
                          onFocus={() => setActiveIndex(flatIndex)}
                          onClick={() => {
                            onRun?.(command)
                            onClose?.()
                          }}
                          css={css`
                            display: flex;
                            align-items: center;
                            justify-content: space-between;
                            gap: 1rem;
                            width: 100%;
                            border: none;
                            background: none;
                            padding: 0.9rem 1.25rem;
                            text-align: left;
                            color: inherit;
                            cursor: pointer;
                            position: relative;
                            transition: background-color var(--hf-motion-duration-fast) var(--hf-motion-ease-standard);
                            ${isActive ? 'background: var(--hf-color-interaction-hover);' : ''}
                          `}
                        >
                          <div
                            css={css`
                              display: flex;
                              flex-direction: column;
                              gap: 0.25rem;
                            `}
                          >
                            <span
                              css={css`
                                font-size: var(--hf-font-size);
                                color: var(--hf-color-heading);
                                display: flex;
                                align-items: center;
                                gap: 0.5rem;
                              `}
                            >
                              {command.icon && <command.icon width={16} height={16} aria-hidden='true' />}
                              {highlightMatch(command.title ?? '', query).map((segment, index) => (
                                <span
                                  key={index}
                                  css={segment.highlight ? css`color: var(--hf-color-accent);` : undefined}
                                >
                                  {segment.text}
                                </span>
                              ))}
                            </span>
                            {command.description && (
                              <span
                                css={css`
                                  font-size: var(--hf-font-size-sm);
                                  color: var(--hf-color-text-muted);
                                `}
                              >
                                {highlightMatch(command.description, query).map((segment, index) => (
                                  <span
                                    key={index}
                                    css={segment.highlight ? css`color: var(--hf-color-accent-muted);` : undefined}
                                  >
                                    {segment.text}
                                  </span>
                                ))}
                              </span>
                            )}
                            {command.tags?.length > 0 && (
                              <div
                                css={css`
                                  display: flex;
                                  flex-wrap: wrap;
                                  gap: 0.35rem;
                                `}
                              >
                                {command.tags.map(tag => (
                                  <span
                                    key={tag}
                                    css={css`
                                      font-size: var(--hf-font-size-xs);
                                      padding: 0.1rem 0.4rem;
                                      border-radius: 999px;
                                      background: var(--hf-color-surface-raised);
                                      color: var(--hf-color-text-muted);
                                    `}
                                  >
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                          <span
                            css={css`
                              font-size: var(--hf-font-size-sm);
                              color: var(--hf-color-text-muted);
                            `}
                          >
                            {bindingToHumanReadable(command.shortcut)}
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Portal>
  )
}
