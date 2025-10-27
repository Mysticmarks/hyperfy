import { css } from '@firebolt-dev/css'
import { useEffect, useMemo, useRef, useState } from 'react'

import { bindingToHumanReadable } from '../utils/inputBindings'
import { Portal } from './Portal'
import { useFocusTrap } from './useFocusTrap'

export function HelpCenter({ open, onClose, articles = [], quickLinks = [], shortcutBindings = {} }) {
  const [query, setQuery] = useState('')
  const containerRef = useRef(null)
  const inputRef = useRef(null)
  useFocusTrap(containerRef, { active: open, initialFocusRef: inputRef })

  useEffect(() => {
    if (!open) {
      setQuery('')
      return
    }
    const onKey = event => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose?.()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const filteredArticles = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return articles
    return articles.filter(article => {
      return (
        article.title?.toLowerCase().includes(q) ||
        article.body?.toLowerCase().includes(q) ||
        article.tags?.some(tag => tag.toLowerCase().includes(q))
      )
    })
  }, [articles, query])

  if (!open) return null

  return (
    <Portal>
      <div
        role='presentation'
        css={css`
          position: fixed;
          inset: 0;
          display: flex;
          justify-content: center;
          background: rgba(5, 6, 16, 0.72);
          backdrop-filter: blur(0.5rem);
          z-index: 38;
        `}
        onClick={event => {
          if (event.target === event.currentTarget) {
            onClose?.()
          }
        }}
      >
        <article
          ref={containerRef}
          aria-label='Help and documentation'
          css={css`
            margin: 3rem 1.5rem;
            width: min(60rem, 100%);
            max-height: calc(100vh - 6rem);
            background: var(--hf-color-surface);
            border-radius: 1.25rem;
            border: 1px solid var(--hf-color-border);
            box-shadow: var(--hf-shadow-soft);
            display: grid;
            grid-template-columns: minmax(0, 2fr) minmax(16rem, 1fr);
            gap: 0;
            overflow: hidden;
          `}
        >
          <section
            css={css`
              padding: 1.5rem;
              border-right: 1px solid var(--hf-color-border);
              display: flex;
              flex-direction: column;
              gap: 1.25rem;
              overflow-y: auto;
            `}
          >
            <header
              css={css`
                display: flex;
                flex-direction: column;
                gap: 0.75rem;
              `}
            >
              <div
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
                  Help Center
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
              </div>
              <label
                css={css`
                  display: flex;
                  gap: 0.5rem;
                  align-items: center;
                  padding: 0.75rem 1rem;
                  border-radius: 0.75rem;
                  background: var(--hf-color-surface-raised);
                  border: 1px solid var(--hf-color-border);
                `}
              >
                <span
                  css={css`
                    font-size: var(--hf-font-size-sm);
                    color: var(--hf-color-text-muted);
                  `}
                >
                  Search
                </span>
                <input
                  ref={inputRef}
                  value={query}
                  onChange={event => setQuery(event.target.value)}
                  placeholder='Search guides, shortcuts, or troubleshooting'
                  css={css`
                    flex: 1;
                    font-size: var(--hf-font-size);
                    color: var(--hf-color-text);
                    background: transparent;
                  `}
                />
              </label>
            </header>
            <div
              css={css`
                display: grid;
                gap: 1rem;
              `}
            >
              {filteredArticles.map(article => (
                <article
                  key={article.id}
                  css={css`
                    padding: 1.25rem;
                    border-radius: 0.9rem;
                    background: var(--hf-color-surface-raised);
                    border: 1px solid var(--hf-color-border);
                    display: grid;
                    gap: 0.5rem;
                  `}
                >
                  <header>
                    <h3
                      css={css`
                        font-size: var(--hf-font-heading);
                        color: var(--hf-color-heading);
                        margin-bottom: 0.35rem;
                      `}
                    >
                      {article.title}
                    </h3>
                    {article.tags && (
                      <div
                        css={css`
                          display: flex;
                          flex-wrap: wrap;
                          gap: 0.4rem;
                        `}
                      >
                        {article.tags.map(tag => (
                          <span
                            key={tag}
                            css={css`
                              padding: 0.15rem 0.5rem;
                              border-radius: 10rem;
                              background: var(--hf-color-primary-soft);
                              color: var(--hf-color-primary);
                              font-size: var(--hf-font-size-sm);
                            `}
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </header>
                  <p
                    css={css`
                      font-size: var(--hf-font-size);
                      color: var(--hf-color-text);
                      line-height: 1.6;
                    `}
                  >
                    {article.body}
                  </p>
                  {article.cta && (
                    <button
                      type='button'
                      onClick={() => article.onSelect?.()}
                      css={css`
                        align-self: flex-start;
                        margin-top: 0.5rem;
                        border-radius: 0.75rem;
                        border: 1px solid var(--hf-color-border-strong);
                        background: var(--hf-color-primary-soft);
                        color: var(--hf-color-heading);
                        padding: 0.5rem 0.9rem;
                        font-size: var(--hf-font-size-sm);
                        transition: background-color var(--hf-motion-duration-fast) var(--hf-motion-ease-standard);
                        &:hover,
                        &:focus-visible {
                          background: rgba(255, 255, 255, 0.12);
                        }
                      `}
                    >
                      {article.cta}
                    </button>
                  )}
                </article>
              ))}
              {filteredArticles.length === 0 && (
                <p
                  css={css`
                    font-size: var(--hf-font-size);
                    color: var(--hf-color-text-muted);
                  `}
                >
                  No help topics matched “{query}”. Try another keyword.
                </p>
              )}
            </div>
          </section>
          <aside
            css={css`
              padding: 1.5rem;
              display: flex;
              flex-direction: column;
              gap: 1.5rem;
              overflow-y: auto;
              background: var(--hf-color-surface-raised);
            `}
          >
            <section>
              <h3
                css={css`
                  font-size: var(--hf-font-heading);
                  color: var(--hf-color-heading);
                  margin-bottom: 0.75rem;
                `}
              >
                Quick links
              </h3>
              <ul
                css={css`
                  display: grid;
                  gap: 0.5rem;
                  list-style: none;
                  padding: 0;
                  margin: 0;
                `}
              >
                {quickLinks.map(link => (
                  <li key={link.title}>
                    <button
                      type='button'
                      onClick={() => link.onSelect?.()}
                      css={css`
                        width: 100%;
                        border-radius: 0.75rem;
                        border: 1px solid var(--hf-color-border);
                        background: none;
                        color: var(--hf-color-text);
                        padding: 0.65rem 0.75rem;
                        text-align: left;
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
                          font-size: var(--hf-font-size);
                          font-weight: 500;
                        `}
                      >
                        {link.title}
                      </div>
                      <div
                        css={css`
                          font-size: var(--hf-font-size-sm);
                          color: var(--hf-color-text-muted);
                        `}
                      >
                        {link.description}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
            <section>
              <h3
                css={css`
                  font-size: var(--hf-font-heading);
                  color: var(--hf-color-heading);
                  margin-bottom: 0.75rem;
                `}
              >
                Keyboard shortcuts
              </h3>
              <dl
                css={css`
                  margin: 0;
                  display: grid;
                  gap: 0.6rem;
                `}
              >
                {Object.entries(shortcutBindings).map(([key, value]) => (
                  <div
                    key={key}
                    css={css`
                      display: flex;
                      justify-content: space-between;
                      gap: 1rem;
                      border-radius: 0.75rem;
                      border: 1px solid var(--hf-color-border);
                      background: var(--hf-color-surface);
                      padding: 0.5rem 0.75rem;
                    `}
                  >
                    <dt
                      css={css`
                        font-size: var(--hf-font-size-sm);
                        color: var(--hf-color-text-muted);
                      `}
                    >
                      {key}
                    </dt>
                    <dd
                      css={css`
                        font-size: var(--hf-font-size-sm);
                        margin: 0;
                        color: var(--hf-color-heading);
                      `}
                    >
                      {bindingToHumanReadable(value) || 'Not set'}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          </aside>
        </article>
      </div>
    </Portal>
  )
}
