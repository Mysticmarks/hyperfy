import { css } from '@firebolt-dev/css'
import { useEffect } from 'react'

import { bindingToHumanReadable } from '../utils/inputBindings'
import { Portal } from './Portal'

export function ShortcutOverlay({ open, onClose, shortcuts = [] }) {
  useEffect(() => {
    if (!open) return
    const handle = event => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose?.()
      }
    }
    window.addEventListener('keydown', handle)
    return () => window.removeEventListener('keydown', handle)
  }, [open, onClose])

  if (!open) return null

  return (
    <Portal>
      <div
        role='presentation'
        css={css`
          position: fixed;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(10, 12, 26, 0.75);
          backdrop-filter: blur(0.75rem);
          z-index: 39;
        `}
        onClick={event => {
          if (event.target === event.currentTarget) {
            onClose?.()
          }
        }}
      >
        <div
          role='dialog'
          aria-modal='true'
          aria-label='Keyboard shortcuts'
          css={css`
            width: min(48rem, 100% - 3rem);
            max-height: calc(100vh - 4rem);
            background: var(--hf-color-surface);
            border-radius: 1.25rem;
            border: 1px solid var(--hf-color-border);
            box-shadow: var(--hf-shadow-soft);
            padding: 2rem;
            overflow-y: auto;
            display: grid;
            gap: 1.5rem;
          `}
        >
          <header
            css={css`
              display: flex;
              justify-content: space-between;
              align-items: center;
            `}
          >
            <h2
              css={css`
                font-size: var(--hf-font-title);
                color: var(--hf-color-heading);
              `}
            >
              Keyboard shortcuts
            </h2>
            <button
              type='button'
              onClick={onClose}
              css={css`
                border: none;
                background: none;
                color: var(--hf-color-text-muted);
                font-size: var(--hf-font-size-sm);
                cursor: pointer;
                transition: color var(--hf-motion-duration-fast) var(--hf-motion-ease-standard);
                &:hover,
                &:focus-visible {
                  color: var(--hf-color-heading);
                }
              `}
            >
              Close
            </button>
          </header>
          <div
            css={css`
              display: grid;
              gap: 1rem;
            `}
          >
            {shortcuts.map(section => (
              <section key={section.title}
                css={css`
                  display: grid;
                  gap: 0.75rem;
                `}
              >
                <h3
                  css={css`
                    font-size: var(--hf-font-heading);
                    color: var(--hf-color-heading);
                  `}
                >
                  {section.title}
                </h3>
                <dl
                  css={css`
                    margin: 0;
                    display: grid;
                    gap: 0.6rem;
                  `}
                >
                  {section.shortcuts.map(item => (
                    <div
                      key={item.label}
                      css={css`
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        gap: 1rem;
                        padding: 0.75rem 1rem;
                        border-radius: 0.75rem;
                        border: 1px solid var(--hf-color-border);
                        background: var(--hf-color-surface-raised);
                      `}
                    >
                      <dt
                        css={css`
                          font-size: var(--hf-font-size);
                          color: var(--hf-color-text);
                          margin: 0;
                        `}
                      >
                        {item.label}
                      </dt>
                      <dd
                        css={css`
                          margin: 0;
                          font-size: var(--hf-font-size-sm);
                          color: var(--hf-color-heading);
                        `}
                      >
                        {bindingToHumanReadable(item.shortcut)}
                      </dd>
                    </div>
                  ))}
                </dl>
              </section>
            ))}
            {shortcuts.length === 0 && (
              <p
                css={css`
                  font-size: var(--hf-font-size);
                  color: var(--hf-color-text-muted);
                `}
              >
                No shortcuts available yet.
              </p>
            )}
          </div>
        </div>
      </div>
    </Portal>
  )
}
