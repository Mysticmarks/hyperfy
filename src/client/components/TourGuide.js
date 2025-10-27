import { css } from '@firebolt-dev/css'
import { useEffect } from 'react'

import { Portal } from './Portal'

export function TourGuide({ tour, stepIndex = 0, onNext, onBack, onDismiss }) {
  const activeStep = tour?.steps?.[stepIndex]

  useEffect(() => {
    if (!tour) return
    const handle = event => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onDismiss?.()
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault()
        onNext?.()
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        onBack?.()
      }
    }
    window.addEventListener('keydown', handle)
    return () => window.removeEventListener('keydown', handle)
  }, [tour, onNext, onBack, onDismiss])

  if (!tour || !activeStep) return null

  return (
    <Portal>
      <div
        role='presentation'
        css={css`
          position: fixed;
          inset: 0;
          pointer-events: none;
          z-index: 41;
        `}
      >
        <div
          role='dialog'
          aria-modal='false'
          aria-live='polite'
          css={css`
            position: absolute;
            bottom: calc(2rem + env(safe-area-inset-bottom));
            left: calc(2rem + env(safe-area-inset-left));
            max-width: min(30rem, calc(100vw - 4rem));
            background: var(--hf-color-surface);
            border-radius: 1rem;
            border: 1px solid var(--hf-color-border);
            box-shadow: var(--hf-shadow-soft);
            padding: 1.5rem;
            display: grid;
            gap: 1rem;
            pointer-events: auto;
          `}
        >
          <header>
            <p
              css={css`
                font-size: var(--hf-font-size-sm);
                color: var(--hf-color-text-muted);
                text-transform: uppercase;
                letter-spacing: 0.08em;
              `}
            >
              {tour.title}
            </p>
            <h2
              css={css`
                font-size: var(--hf-font-heading);
                color: var(--hf-color-heading);
                margin-top: 0.35rem;
              `}
            >
              {activeStep.title}
            </h2>
          </header>
          <p
            css={css`
              font-size: var(--hf-font-size);
              line-height: 1.6;
              color: var(--hf-color-text);
            `}
          >
            {activeStep.body}
          </p>
          {activeStep.hint && (
            <p
              css={css`
                font-size: var(--hf-font-size-sm);
                color: var(--hf-color-text-muted);
              `}
            >
              {activeStep.hint}
            </p>
          )}
          <footer
            css={css`
              display: flex;
              justify-content: space-between;
              align-items: center;
            `}
          >
            <div
              css={css`
                font-size: var(--hf-font-size-sm);
                color: var(--hf-color-text-muted);
              `}
            >
              Step {stepIndex + 1} of {tour.steps.length}
            </div>
            <div
              css={css`
                display: flex;
                gap: 0.75rem;
              `}
            >
              <button
                type='button'
                onClick={onDismiss}
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
                Skip tour
              </button>
              <div
                css={css`
                  display: flex;
                  gap: 0.5rem;
                `}
              >
                <button
                  type='button'
                  onClick={onBack}
                  disabled={stepIndex === 0}
                  css={css`
                    border-radius: 0.75rem;
                    border: 1px solid var(--hf-color-border);
                    background: none;
                    color: var(--hf-color-text);
                    padding: 0.45rem 0.9rem;
                    font-size: var(--hf-font-size-sm);
                    cursor: pointer;
                    transition: background-color var(--hf-motion-duration-fast) var(--hf-motion-ease-standard);
                    &:disabled {
                      opacity: 0.5;
                      cursor: default;
                    }
                    &:hover:not(:disabled),
                    &:focus-visible:not(:disabled) {
                      background: var(--hf-color-interaction-hover);
                    }
                  `}
                >
                  Back
                </button>
                <button
                  type='button'
                  onClick={onNext}
                  css={css`
                    border-radius: 0.75rem;
                    border: 1px solid var(--hf-color-border-strong);
                    background: var(--hf-color-primary);
                    color: hsl(var(--hf-neutral-hue) 20% 10%);
                    padding: 0.45rem 0.95rem;
                    font-size: var(--hf-font-size-sm);
                    cursor: pointer;
                    transition: transform var(--hf-motion-duration-fast) var(--hf-motion-ease-standard),
                      filter var(--hf-motion-duration-fast) var(--hf-motion-ease-standard);
                    &:hover,
                    &:focus-visible {
                      transform: translateY(-1px);
                      filter: brightness(1.05);
                    }
                  `}
                >
                  {stepIndex === tour.steps.length - 1 ? 'Finish' : 'Next'}
                </button>
              </div>
            </div>
          </footer>
        </div>
      </div>
    </Portal>
  )
}
