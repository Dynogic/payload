import type { Config } from './types.js'

type RouteGetter = () => string

type DynamicRoutesConfig = {
  admin?: RouteGetter | string
  api?: RouteGetter | string
  graphQL?: RouteGetter | string
  graphQLPlayground?: RouteGetter | string
}

/**
 * Creates a routes object with getter support for dynamic route resolution.
 * Useful for multi-tenant setups where routes vary by request context.
 *
 * @example
 * ```typescript
 * import { buildConfig, createDynamicRoutes } from 'payload';
 *
 * export default buildConfig({
 *   routes: createDynamicRoutes({
 *     admin: () => getAdminRoute('admin'),
 *     api: () => getAdminRoute('admin-api'),
 *     graphQL: '/graphql', // Static routes still work
 *   }),
 * });
 * ```
 */
export function createDynamicRoutes(config: DynamicRoutesConfig): Config['routes'] {
  const routes: Record<string, string> = {}

  for (const [key, value] of Object.entries(config)) {
    if (typeof value === 'function') {
      Object.defineProperty(routes, key, {
        configurable: true,
        enumerable: true,
        get: value,
      })
    } else {
      Object.defineProperty(routes, key, {
        configurable: true,
        enumerable: true,
        value,
        writable: true,
      })
    }
  }

  return routes as Config['routes']
}
