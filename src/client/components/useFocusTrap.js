import { useEffect } from 'react'

const FOCUSABLE_SELECTOR =
  'a[href], area[href], button:not([disabled]), input:not([disabled]):not([type=hidden]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

function getFocusableElements(root) {
  if (!root) return []
  const elements = Array.from(root.querySelectorAll(FOCUSABLE_SELECTOR))
  return elements.filter(element => element.offsetParent !== null || element === document.activeElement)
}

export function useFocusTrap(ref, { active = true, initialFocusRef } = {}) {
  useEffect(() => {
    if (!active) return
    const node = ref.current
    if (!node) return

    const previousActive = document.activeElement
    const focusTarget = initialFocusRef?.current || node.querySelector('[data-initial-focus]') || node

    const focus = () => {
      if (focusTarget && typeof focusTarget.focus === 'function') {
        focusTarget.focus()
        return
      }
      if (typeof node.focus === 'function') {
        node.focus()
      }
    }

    const raf = requestAnimationFrame(focus)

    const handleKeyDown = event => {
      if (event.key !== 'Tab') return
      const focusable = getFocusableElements(node)
      if (focusable.length === 0) {
        event.preventDefault()
        focus()
        return
      }
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const activeElement = document.activeElement

      if (event.shiftKey) {
        if (activeElement === first || !node.contains(activeElement)) {
          event.preventDefault()
          last.focus()
        }
      } else {
        if (activeElement === last) {
          event.preventDefault()
          first.focus()
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      cancelAnimationFrame(raf)
      document.removeEventListener('keydown', handleKeyDown)
      if (previousActive && typeof previousActive.focus === 'function') {
        previousActive.focus()
      }
    }
  }, [active, ref, initialFocusRef])
}
