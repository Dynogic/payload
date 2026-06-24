import type { ReadonlyRequestCookies } from 'next/dist/server/web/spec-extension/adapters/request-cookies.js'
import type { SanitizedConfig } from 'payload'

import { defaultTheme, type Theme } from '@payloadcms/ui'

type GetRequestLanguageArgs = {
  config: SanitizedConfig
  cookies: Map<string, string> | ReadonlyRequestCookies
  headers: Request['headers']
}

const acceptedThemes: Theme[] = ['dark', 'light']

// Varig fork: dark by default, no system/OS theme. We resolve the theme from a
// pinned `admin.theme` or the user's explicit theme cookie only — the
// `Sec-CH-Prefers-Color-Scheme` client hint is deliberately ignored so the
// server-rendered theme is deterministic (no light-then-dark flash on load).
export const getRequestTheme = ({ config, cookies }: GetRequestLanguageArgs): Theme => {
  if (config.admin.theme !== 'all' && acceptedThemes.includes(config.admin.theme)) {
    return config.admin.theme
  }

  const themeCookie = cookies.get(`${config.cookiePrefix || 'payload'}-theme`)

  const themeFromCookie: Theme = (
    typeof themeCookie === 'string' ? themeCookie : themeCookie?.value
  ) as Theme

  if (themeFromCookie && acceptedThemes.includes(themeFromCookie)) {
    return themeFromCookie
  }

  return defaultTheme
}
