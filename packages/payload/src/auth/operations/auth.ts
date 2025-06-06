import type { SanitizedPermissions, TypedUser } from '../../index.js'
import type { PayloadRequest } from '../../types/index.js'

import { killTransaction } from '../../utilities/killTransaction.js'
import { executeAuthStrategies } from '../executeAuthStrategies.js'
import { getAccessResults } from '../getAccessResults.js'

export type AuthArgs = {
  /**
   * Specify if it's possible for auth strategies to set headers within this operation.
   */
  canSetHeaders?: boolean
  headers: Request['headers']
  req?: Omit<PayloadRequest, 'user'>
}

export type AuthResult = {
  permissions: SanitizedPermissions
  responseHeaders?: Headers
  user: null | TypedUser
}

export const auth = async (args: Required<AuthArgs>): Promise<AuthResult> => {
  const { canSetHeaders, headers } = args
  const req = args.req as PayloadRequest
  const { payload } = req

  try {
    const { responseHeaders, user } = await executeAuthStrategies({
      canSetHeaders,
      headers,
      payload,
    })

    req.user = user
    req.responseHeaders = responseHeaders

    const permissions = await getAccessResults({
      req,
    })

    return {
      permissions,
      responseHeaders,
      user,
    }
  } catch (error: unknown) {
    await killTransaction(req)
    throw error
  }
}
