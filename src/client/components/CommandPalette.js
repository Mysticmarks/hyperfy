import { css } from '@firebolt-dev/css'
import { useEffect, useMemo, useRef, useState } from 'react'

import { bindingToHumanReadable } from '../utils/inputBindings'
import { Portal } from './Portal'
import { useFocusTrap } from './useFocusTrap'

export function CommandPalette({ open, onClose, commands = [], onRun }) {
  const [query, setQuery] = useState('')
  const listRef = useRef(null)
  const inputRef = useRef(null)
  useFocusTrap(listRef, { active: open })

  useEffect(() => {
    if (!open) {
      setQuery('')
      return
    }
    const timeout = setTimeout(() => {
      inputRef.current?.focus()
      inputRef.current?.select()
    }, 16)
    return () => clearTimeout(timeout)
  }, [open])

  useEffect(() => {
    if (!open) return
    const handleKeyDown = event => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose?.()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  const filtered = useMemo(() => {
    if (!query) return commands
    const q = query.toLowerCase().trim()
    if (!q) return commands
    return commands.filter(cmd => {
      return (
        cmd.title?.toLowerCase().includes(q) ||
        cmd.description?.toLowerCase().includes(q) ||
        cmd.tags?.some(tag => tag.toLowerCase().includes(q))
      )
    })
  }, [commands, query])

  if (!open) return null

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
            transition: transform var(--hf-motion-duration-medium) var(--hf-motion-ease-standard);
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
            {filtered.length === 0 && (
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
            {filtered.map(cmd => (
              <li key={cmd.id}>
                <button
                  type='button'
                  onClick={() => {
                    onRun?.(cmd)
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
                    transition: background-color var(--hf-motion-duration-fast) var(--hf-motion-ease-standard);
                    &:hover,
                    &:focus-visible {
                      background: var(--hf-color-interaction-hover);
                    }
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
                      `}
                    >
                      {cmd.title}
                    </span>
                    {cmd.description && (
                      <span
                        css={css`
                          font-size: var(--hf-font-size-sm);
                          color: var(--hf-color-text-muted);
                        `}
                      >
                        {cmd.description}
                      </span>
                    )}
                  </div>
                  <span
                    css={css`
                      font-size: var(--hf-font-size-sm);
                      color: var(--hf-color-text-muted);
                    `}
                  >
                    {bindingToHumanReadable(cmd.shortcut)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Portal>
  )
}
