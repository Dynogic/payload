import type { AcceptedLanguages } from '@payloadcms/translations'
import type { ReadonlyRequestCookies } from 'next/dist/server/web/spec-extension/adapters/request-cookies.js'

import { extractHeaderLanguage } from '@payloadcms/translations'

import type { SanitizedConfig } from '../config/types.js'

type GetRequestLanguageArgs = {
  config: SanitizedConfig
  cookies: Map<string, string> | ReadonlyRequestCookies
  defaultLanguage?: AcceptedLanguages
  headers: Request['headers']
}

export const getRequestLanguage = ({
  config,
  cookies,
  headers,
}: GetRequestLanguageArgs): AcceptedLanguages => {
  const supportedLanguageKeys = Object.keys(config.i18n.supportedLanguages) as AcceptedLanguages[]
  const langCookie = cookies.get(`${config.cookiePrefix || 'payload'}-lng`)

  const cookieValue = typeof langCookie === 'string' ? langCookie : langCookie?.value

  // If a custom resolver is provided, use it
  if (config.i18n.resolveLanguage) {
    return config.i18n.resolveLanguage({
      acceptLanguageHeader: headers.get('Accept-Language') || undefined,
      cookieValue,
      fallbackLanguage: config.i18n.fallbackLanguage,
      supportedLanguages: supportedLanguageKeys,
    }) as AcceptedLanguages
  }

  // Default exact-match behavior
  const languageFromCookie = cookieValue as AcceptedLanguages

  if (languageFromCookie && supportedLanguageKeys.includes(languageFromCookie)) {
    return languageFromCookie
  }

  const languageFromHeader = headers.get('Accept-Language')
    ? extractHeaderLanguage(headers.get('Accept-Language')!)
    : undefined

  if (languageFromHeader && supportedLanguageKeys.includes(languageFromHeader)) {
    return languageFromHeader
  }

  return config.i18n.fallbackLanguage
}
