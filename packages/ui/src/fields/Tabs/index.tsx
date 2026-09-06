'use client'
import type {
  ClientComponentProps,
  ClientTab,
  SanitizedFieldPermissions,
  StaticDescription,
  TabsFieldClientComponent,
} from 'payload'

import { getTranslation } from '@payloadcms/translations'
import { useSearchParams } from 'next/navigation.js'
import { getFieldPaths, toKebabCase } from 'payload/shared'
import React, { useCallback, useEffect, useRef, useState } from 'react'

import { useCollapsible } from '../../elements/Collapsible/provider.js'
import { useOptionalDocumentDrawerContext } from '../../elements/DocumentDrawer/Provider.js'
import { RenderCustomComponent } from '../../elements/RenderCustomComponent/index.js'
import { useFormFields } from '../../forms/Form/index.js'
import { RenderFields } from '../../forms/RenderFields/index.js'
import { useField } from '../../forms/useField/index.js'
import { withCondition } from '../../forms/withCondition/index.js'
import { useTranslation } from '../../providers/Translation/index.js'
import { FieldDescription } from '../FieldDescription/index.js'
import { fieldBaseClass } from '../shared/index.js'
import { TabsProvider } from './provider.js'
import { resolveActiveTabIndex } from './resolveTabIndex.js'
import { TabComponent } from './Tab/index.js'
import './index.scss'

const baseClass = 'tabs-field'

// FORK (#78): the query param that addresses a document tab (`?tab=<slug>`).
// A cross-repo contract — consuming apps build deep links with the same name.
const TabSearchParam = 'tab'

export { TabsProvider }

const TabsFieldComponent: TabsFieldClientComponent = (props) => {
  const {
    field: { admin: { className, hideWhenSingle = false } = {}, tabs = [] },
    forceRender = false,
    indexPath = '',
    parentPath = '',
    parentSchemaPath = '',
    path = '',
    permissions,
    readOnly,
    schemaPath = '',
  } = props

  const { i18n } = useTranslation()
  const { isWithinCollapsible } = useCollapsible()

  // A DocumentDrawer layers its doc OVER another document whose Tabs field
  // reads the SAME URL. So a Tabs field inside a drawer must NOT read or write
  // the `tab` param (#59) — otherwise clicking a drawer tab whose `slug`
  // collides with the underlying doc's (e.g. 'content'/'page') makes that
  // underlying doc jump tabs, desyncing/closing the drawer and wedging focus.
  // Inside a drawer tab state is purely local; only the top-level document
  // owns the URL. `hideTabs` (drawer-only) trims tabs by `slug`, folded into
  // `passesCondition`.
  const drawerContext = useOptionalDocumentDrawerContext()
  const inDrawer = !!drawerContext
  const hideTabs = drawerContext?.hideTabs

  const tabStates = useFormFields(([fields]) => {
    return tabs.map((tab, index) => {
      const id = tab?.id
      // FORK (offer-layouts): key the tab's passesCondition by the tabs field's
      // OWN `path`, not its `parentPath`. The form-state builder writes the tab
      // state under `${tabsFieldPath}.${tab.id}` (addFieldStatePromise passes the
      // tabs field's `path` as the tab's parentPath), but the renderer used this
      // component's `parentPath` (the tabs field's PARENT), which for a top-level
      // tabs field is '' — so the lookup key never matched and a tab-level
      // admin.condition could never hide the header. `path` matches the writer.
      const fieldKey = path ? `${path}.${id}` : id
      const hiddenInDrawer = Boolean(hideTabs?.length && tab.slug && hideTabs.includes(tab.slug))
      return {
        slug: tab.slug,
        index,
        passesCondition: (fields?.[fieldKey]?.passesCondition ?? true) && !hiddenInDrawer,
        tab,
      }
    })
  })

  // FORK (#78): `?tab=<slug>` replaces the URL hash (#8). The param is read
  // through Next's router so the SAME value resolves on the server and the
  // client — the addressed tab is in the SSR HTML, no post-hydration flip.
  // Any tabs field whose tabs carry slugs owns the param; a field without
  // slugs never touches the URL and stays purely local.
  const searchParams = useSearchParams()
  const tabParam = inDrawer ? null : (searchParams?.get(TabSearchParam) ?? null)
  const ownsTabParam = !inDrawer && tabs.some((tab) => Boolean(tab.slug))

  // Local click state — the only state the field keeps. `wrote` is the param
  // value the click's own replaceState set (undefined = no URL write); it
  // marks the click as "in flight" until the router reflects it, so the
  // switch never waits on Next's async search-param sync.
  const [local, setLocal] = useState<{ index: number; wrote?: null | string } | null>(null)

  const activeTabIndex = resolveActiveTabIndex({
    localIndex: local?.index ?? null,
    pendingLocal: local?.wrote !== undefined && local.wrote !== tabParam,
    slugParam: tabParam,
    tabStates,
  })

  // When the param changes under us, decide whose change it was: our own
  // write landing keeps the click (and clears the in-flight mark); anything
  // else (popstate, a Next navigation, another field's write) means the URL
  // is the truth and the stale click is dropped. Never runs in a drawer
  // (the param belongs to the underlying doc) and never on mount (the
  // initial render already derived from the param).
  const mountedRef = useRef(false)
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true
      return
    }
    if (inDrawer) {
      return
    }
    setLocal((prev) => {
      if (!prev) {
        return prev
      }
      if (prev.wrote !== undefined && prev.wrote === tabParam) {
        return { index: prev.index }
      }
      return null
    })
  }, [tabParam, inDrawer])

  const activeTabInfo = tabStates[activeTabIndex]
  const activeTabConfig = activeTabInfo?.tab
  const activeTabDescription = activeTabConfig?.admin?.description ?? activeTabConfig?.description

  const activeTabStaticDescription =
    typeof activeTabDescription === 'function'
      ? activeTabDescription({ i18n, t: i18n.t })
      : activeTabDescription

  const visibleTabCount = tabStates.filter(({ passesCondition }) => passesCondition).length
  const hasVisibleTabs = visibleTabCount > 0
  // FORK (#81): an opted-in field with at most one visible tab renders that
  // tab's content bare — no tab bar, no `__after-tabs` slot (consumers that
  // portal into the slot must fall back when it is absent).
  const hideTabBar = hideWhenSingle && visibleTabCount <= 1

  const handleTabChange = useCallback(
    (incomingTabIndex: number): void => {
      // In a drawer, or in a slug-less field, switching a tab stays local —
      // never touch the URL.
      if (typeof window === 'undefined' || !ownsTabParam) {
        setLocal({ index: incomingTabIndex })
        return
      }

      const selectedSlug = tabs[incomingTabIndex]?.slug ?? null

      // Rebuild the query string around the `tab` param only — every other
      // param and the fragment pass through untouched (a fragment is an
      // in-page anchor now, never a tab).
      const params = new URLSearchParams(window.location.search)
      if (selectedSlug) {
        params.set(TabSearchParam, selectedSlug)
      } else {
        params.delete(TabSearchParam)
      }
      const qs = params.toString()
      const nextUrl = `${window.location.pathname}${qs ? `?${qs}` : ''}${window.location.hash}`
      const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`

      // No-op guard (#70): an identical-URL replaceState still runs Next's
      // history-wrapper router sync, and a gratuitous write colliding with
      // another history write in the same commit can wedge Next's
      // server-action queue (pending fetches never dispatch — diagnosed in
      // the consuming app 2026-07-02). Re-clicking the active tab, or a
      // slug-less tab on a param-less URL, changes nothing — skip the write.
      if (nextUrl === currentUrl) {
        setLocal({ index: incomingTabIndex })
        return
      }

      // replaceState, not pushState: a tab is a lens on the document, not a
      // destination — Back leaves the document, it doesn't step through tabs.
      setLocal({ index: incomingTabIndex, wrote: selectedSlug })
      window.history.replaceState(null, '', nextUrl)
    },
    [tabs, ownsTabParam],
  )

  // Announce every change of the DERIVED active tab — clicks, popstate, Next
  // navigations alike — so consuming-app listeners (sidebar highlight, tab-row
  // portal slots, live-preview mode) follow the tab regardless of who moved
  // it. Not on mount (no change yet) and never from a drawer (#59). The event
  // name + `{ name, index, label, parentPath }` detail are the #22 contract;
  // `slug` is additive.
  const announcedRef = useRef<null | number>(null)
  useEffect(() => {
    if (inDrawer || typeof window === 'undefined') {
      return
    }
    if (announcedRef.current === null) {
      announcedRef.current = activeTabIndex
      return
    }
    if (announcedRef.current === activeTabIndex) {
      return
    }
    announcedRef.current = activeTabIndex
    const selectedTab = tabs[activeTabIndex]
    window.dispatchEvent(
      new CustomEvent('payload-tab-change', {
        detail: {
          name: (selectedTab as { name?: string } | undefined)?.name,
          slug: selectedTab?.slug,
          index: activeTabIndex,
          label: selectedTab?.label,
          parentPath,
        },
      }),
    )
  }, [activeTabIndex, inDrawer, tabs, parentPath])
  return (
    <div
      className={[
        fieldBaseClass,
        className,
        baseClass,
        isWithinCollapsible && `${baseClass}--within-collapsible`,
        !hasVisibleTabs && `${baseClass}--hidden`,
        hideTabBar && `${baseClass}--bar-hidden`,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <TabsProvider>
        {!hideTabBar && (
          <div className={`${baseClass}__tabs-wrap`}>
            <div className={`${baseClass}__tabs`}>
              {tabStates.map(({ index, passesCondition, tab }) => (
                <TabComponent
                  hidden={!passesCondition}
                  isActive={activeTabIndex === index}
                  key={index}
                  parentPath={path}
                  setIsActive={() => {
                    handleTabChange(index)
                  }}
                  tab={tab}
                />
              ))}
            </div>
            {/* FORK (#76): zero-API right-side portal target on the tab row. The id is
              deterministic per tabs field — `after-tabs-<path>` with dots flattened to
              `__` (a top-level unnamed tabs field's path is its `_index-N` segment) —
              so nested tabs fields keep distinct ids. Consumers that can mount inside
              drawers should resolve their OWN field's slot by ancestor scoping
              (closest('.tabs-field') → its `> .tabs-field__tabs-wrap > .tabs-field__after-tabs`)
              rather than a document-wide id lookup, since the same collection open in a
              drawer repeats the path. Keep slot content no taller than the tab row. */}
            <div
              className={`${baseClass}__after-tabs`}
              id={`after-tabs-${(path || 'tabs').replace(/\./g, '__')}`}
            />
          </div>
        )}
        <div className={`${baseClass}__content-wrap`}>
          {activeTabConfig && (
            <TabContent
              description={activeTabStaticDescription}
              field={activeTabConfig}
              forceRender={forceRender}
              hidden={false}
              parentIndexPath={indexPath}
              parentPath={path}
              parentSchemaPath={schemaPath}
              path={path}
              permissions={
                permissions && typeof permissions === 'object' && 'name' in activeTabConfig
                  ? permissions[activeTabConfig.name] &&
                    typeof permissions[activeTabConfig.name] === 'object' &&
                    'fields' in permissions[activeTabConfig.name]
                    ? permissions[activeTabConfig.name].fields
                    : permissions[activeTabConfig.name]
                  : permissions
              }
              readOnly={readOnly}
              tabIndex={activeTabIndex}
            />
          )}
        </div>
      </TabsProvider>
    </div>
  )
}

export const TabsField = withCondition(TabsFieldComponent)

type ActiveTabProps = {
  readonly description: StaticDescription
  readonly field: ClientTab
  readonly hidden: boolean
  readonly label?: string
  readonly parentIndexPath: string
  readonly parentPath: string
  readonly parentSchemaPath: string
  readonly path: string
  readonly permissions: SanitizedFieldPermissions
  readonly readOnly: boolean
  readonly tabIndex: number
} & Pick<ClientComponentProps, 'forceRender'>

function TabContent({
  description,
  field,
  forceRender,
  hidden,
  label,
  parentIndexPath,
  parentPath,
  parentSchemaPath,
  permissions,
  readOnly,
  tabIndex,
}: ActiveTabProps) {
  const { i18n } = useTranslation()

  const { customComponents: { AfterInput, BeforeInput, Description, Field } = {} } = useField()

  if (Field) {
    return Field
  }

  const { indexPath, path, schemaPath } = getFieldPaths({
    field,
    index: tabIndex,
    parentIndexPath,
    parentPath,
    parentSchemaPath,
  })

  return (
    <div
      className={[
        hidden && `${baseClass}__tab--hidden`,
        `${baseClass}__tab`,
        label && `${baseClass}__tabConfigLabel-${toKebabCase(getTranslation(label, i18n))}`,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <RenderCustomComponent
        CustomComponent={Description}
        Fallback={
          <FieldDescription description={description} marginPlacement="bottom" path={parentPath} />
        }
      />
      {BeforeInput}
      <RenderFields
        fields={field.fields}
        forceRender={forceRender}
        parentIndexPath={indexPath}
        parentPath={path}
        parentSchemaPath={schemaPath}
        permissions={permissions}
        readOnly={readOnly}
      />
      {AfterInput}
    </div>
  )
}
