'use client'

import { useEffect, useRef } from 'react'

export const useAppKitScrollLock = () => {
  const isModalOpen = useRef(false)

  useEffect(() => {
    const disableScroll = () => {
      document.body.style.overflow = 'hidden'
      document.body.classList.add('w3m-modal-open')
      isModalOpen.current = true
    }

    const enableScroll = () => {
      document.body.style.overflow = 'unset'
      document.body.classList.remove('w3m-modal-open')
      isModalOpen.current = false
    }

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
          const hasModal = document.querySelector('w3m-modal[open]') ||
                          document.querySelector('[data-w3m-modal][open]') ||
                          document.querySelector('.w3m-modal[open]') ||
                          document.querySelector('w3m-modal:not([style*="display: none"])') ||
                          document.querySelector('[data-w3m-modal]:not([style*="display: none"])')

          if (hasModal && !isModalOpen.current) {
            disableScroll()
          } else if (!hasModal && isModalOpen.current) {
            enableScroll()
          }
        }
      })
    })

    observer.observe(document.body, { childList: true, subtree: true })

    return () => {
      observer.disconnect()
      enableScroll()
    }
  }, [])
}
