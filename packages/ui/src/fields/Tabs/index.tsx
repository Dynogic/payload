'use client'
import type {
  ClientComponentProps,
  ClientTab,
  SanitizedFieldPermissions,
  StaticDescription,
  TabsFieldClientComponent,
} from 'payload'

import { getTranslation } from '@payloadcms/translations'
import { getFieldPaths, toKebabCase } from 'payload/shared'
import React, { useCallback, useEffect, useState } from 'react'

import { useCollapsible } from '../../elements/Collapsible/provider.js'
import { RenderCustomComponent } from '../../elements/RenderCustomComponent/index.js'
import { useFormFields } from '../../forms/Form/index.js'
import { RenderFields } from '../../forms/RenderFields/index.js'
import { useField } from '../../forms/useField/index.js'
import { withCondition } from '../../forms/withCondition/index.js'
import { useTranslation } from '../../providers/Translation/index.js'
import { FieldDescription } from '../FieldDescription/index.js'
import { fieldBaseClass } from '../shared/index.js'
import { TabsProvider } from './provider.js'
import { TabComponent } from './Tab/index.js'
import './index.scss'

const baseClass = 'tabs-field'

export { TabsProvider }

const TabsFieldComponent: TabsFieldClientComponent = (props) => {
  const {
    field: { admin: { className } = {}, tabs = [] },
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

  const tabStates = useFormFields(([fields]) => {
    return tabs.map((tab, index) => {
      const id = tab?.id
      const fieldKey = parentPath ? `${parentPath}.${id}` : id
      return {
        index,
        passesCondition: fields?.[fieldKey]?.passesCondition ?? true,
        tab,
      }
    })
  })

  // Helper function to get tab index from URL hash (single-level matching)
  const getTabIndexFromHash = useCallback(
    (currentTabStates?: Array<{ index: number; passesCondition: boolean; tab: ClientTab }>) => {
      if (typeof window === 'undefined' || !window.location.hash) {
        return null
      }

      const hash = window.location.hash.substring(1) // Remove the # symbol

      const foundTabIndex = tabs.findIndex((tab) => (tab as any).hash && (tab as any).hash === hash)

      if (foundTabIndex !== -1) {
        const passesCondition = currentTabStates
          ? (currentTabStates[foundTabIndex]?.passesCondition ?? true)
          : true

        if (passesCondition) {
          return foundTabIndex
        }
      }

      return null
    },
    [tabs],
  )

  // Initialize with first visible tab (same on server and client to avoid hydration mismatch)
  // Hash-based selection happens in useEffect after hydration
  const [activeTabIndex, setActiveTabIndex] = useState<number>(
    () => tabStates.filter(({ passesCondition }) => passesCondition)?.[0]?.index ?? 0,
  )

  const activeTabInfo = tabStates[activeTabIndex]
  const activeTabConfig = activeTabInfo?.tab
  const activeTabDescription = activeTabConfig?.admin?.description ?? activeTabConfig?.description

  const activeTabStaticDescription =
    typeof activeTabDescription === 'function'
      ? activeTabDescription({ i18n, t: i18n.t })
      : activeTabDescription

  const hasVisibleTabs = tabStates.some(({ passesCondition }) => passesCondition)

  const handleTabChange = useCallback(
    (incomingTabIndex: number): void => {
      setActiveTabIndex(incomingTabIndex)

      if (typeof window !== 'undefined') {
        const selectedTab = tabs[incomingTabIndex]

        // Dispatch tab change event for external listeners
        window.dispatchEvent(
          new CustomEvent('payload-tab-change', {
            detail: {
              name: (selectedTab as any)?.name,
              index: incomingTabIndex,
              label: selectedTab?.label,
              parentPath,
            },
          }),
        )

        // Update URL hash if tab has a hash value
        const selectedTabHash = (selectedTab as any).hash

        if (selectedTabHash) {
          window.history.replaceState(null, '', `#${selectedTabHash}`)
        } else {
          // Clear hash if tab has no hash value
          window.history.replaceState(null, '', window.location.pathname + window.location.search)
        }
      }
    },
    [tabs, parentPath],
  )

  // Track if we've done initial setup to avoid overriding manual tab changes
  const [hasInitialized, setHasInitialized] = useState(false)

  // Handle initial tab selection based on hash or first visible tab
  useEffect(() => {
    if (hasInitialized || tabStates.length === 0) {
      return
    }

    const hashTabIndex = getTabIndexFromHash(tabStates)

    if (hashTabIndex !== null) {
      if (activeTabIndex !== hashTabIndex) {
        setActiveTabIndex(hashTabIndex)
      }
      setHasInitialized(true)
      return
    }

    // No hash found, use first visible tab
    const firstVisibleIndex = tabStates.find(({ passesCondition }) => passesCondition)?.index ?? 0

    if (activeTabIndex !== firstVisibleIndex) {
      setActiveTabIndex(firstVisibleIndex)
    }
    setHasInitialized(true)
  }, [tabStates, getTabIndexFromHash, activeTabIndex, hasInitialized])

  useEffect(() => {
    if (activeTabInfo?.passesCondition === false) {
      const nextTab = tabStates.find(({ passesCondition }) => passesCondition)
      if (nextTab) {
        handleTabChange(nextTab.index)
      }
    }
  }, [activeTabInfo, tabStates, handleTabChange])

  // Listen for hash changes to update active tab
  useEffect(() => {
    const handleHashChange = () => {
      const hashTabIndex = getTabIndexFromHash(tabStates)

      if (hashTabIndex !== null && hashTabIndex !== activeTabIndex) {
        setActiveTabIndex(hashTabIndex)
      }
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('hashchange', handleHashChange)
      return () => {
        window.removeEventListener('hashchange', handleHashChange)
      }
    }
  }, [getTabIndexFromHash, activeTabIndex, tabStates])

  // Also check hash on every render (for Next.js navigation that doesn't trigger hashchange)
  useEffect(() => {
    if (tabStates.length === 0 || typeof window === 'undefined') {
      return
    }

    const hashTabIndex = getTabIndexFromHash(tabStates)

    if (hashTabIndex !== null && hashTabIndex !== activeTabIndex) {
      setActiveTabIndex(hashTabIndex)
    }
  }) // No dependency array - runs on every render to catch Next.js navigation

  return (
    <div
      className={[
        fieldBaseClass,
        className,
        baseClass,
        isWithinCollapsible && `${baseClass}--within-collapsible`,
        !hasVisibleTabs && `${baseClass}--hidden`,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <TabsProvider>
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
        </div>
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
