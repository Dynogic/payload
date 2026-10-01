'use client'
import { useWindowInfo } from '@faceless-ui/window-info'
import { PREFERENCE_KEYS } from 'payload/shared'
import { useCallback } from 'react'

import { usePreferences } from '../../providers/Preferences/index.js'
import { useNav } from './context.js'

/**
 * Open or close the nav AS THE USER DID IT (fork #105): sets the nav state
 * and, on desktop, saves the choice as the `nav` preference, exactly what
 * the built-in `NavToggler` does on click. `setNavOpen` alone only flips the
 * state (the js opening or closing the nav for window size or routing must
 * not overwrite the preference), so an app's own open / close buttons call
 * this instead. With no argument it toggles.
 */
export const useNavToggle = (): ((open?: boolean) => Promise<void>) => {
  const { setPreference } = usePreferences()
  const { navOpen, setNavOpen } = useNav()
  const {
    breakpoints: { l: largeBreak },
  } = useWindowInfo()

  return useCallback(
    async (open?: boolean) => {
      const next = typeof open === 'boolean' ? open : !navOpen
      setNavOpen(next)
      // only when the user explicitly toggles the nav on desktop do we want to set the preference
      // this is because the js may open or close the nav based on the window size, routing, etc
      if (!largeBreak) {
        await setPreference(PREFERENCE_KEYS.NAV, { open: next }, true)
      }
    },
    [largeBreak, navOpen, setNavOpen, setPreference],
  )
}
