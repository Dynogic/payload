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

  // Only apply hash-based navigation for root-level tabs (collection tabs)
  // Nested tabs within fields should not respond to URL hash changes
  // Root level tabs have simple indexPath like '0', '1', etc.
  // Nested tabs have complex indexPath like '1-2-0', '0-1-2', etc.
  const isRootLevelTabs = !indexPath.includes('-')

  // Helper function to get tab index from URL hash
  const getTabIndexFromHash = useCallback((currentTabStates?: Array<{ index: number; passesCondition: boolean; tab: ClientTab }>) => {
    // Only handle hash navigation for root-level tabs and when in browser environment
    if (!isRootLevelTabs || typeof window === 'undefined') {
      return null
    }
    
    if (typeof window !== 'undefined' && window.location.hash) {
      const fullHash = window.location.hash.substring(1) // Remove the # symbol
      
      // For two-level hashes like "settings-advanced", we want to match just the first part for root tabs
      // For nested tabs, we'll handle the second part separately
      const [mainTabHash, subTabHash] = fullHash.split('-', 2)
      const hashTabValue = isRootLevelTabs ? mainTabHash : fullHash
      
      const foundTabIndex = tabs.findIndex((tab) => 
        (tab as any).hash && (tab as any).hash === hashTabValue
      )
      
      if (foundTabIndex !== -1) {
        // Check if the tab passes condition using provided tabStates or fallback to true
        const passesCondition = currentTabStates 
          ? currentTabStates[foundTabIndex]?.passesCondition ?? true
          : true
        
        if (passesCondition) {
          return foundTabIndex
        }
      }
    }
    return null
  }, [tabs, isRootLevelTabs])

  // Helper function to get sub-tab hash for nested tabs
  const getSubTabHashFromURL = useCallback(() => {
    if (isRootLevelTabs || typeof window === 'undefined' || !window.location.hash) {
      return null
    }
    
    const fullHash = window.location.hash.substring(1)
    const [mainTabHash, subTabHash] = fullHash.split('-', 2)
    
    return subTabHash || null
  }, [isRootLevelTabs])

  // For nested tabs, check if there's a sub-tab hash to use
  const getNestedTabIndexFromHash = useCallback((currentTabStates?: Array<{ index: number; passesCondition: boolean; tab: ClientTab }>) => {
    if (isRootLevelTabs) {
      return null
    }
    
    const subTabHash = getSubTabHashFromURL()
    if (!subTabHash) {
      return null
    }
    
    const foundTabIndex = tabs.findIndex((tab) => 
      (tab as any).hash && (tab as any).hash === subTabHash
    )
    
    if (foundTabIndex !== -1) {
      const passesCondition = currentTabStates 
        ? currentTabStates[foundTabIndex]?.passesCondition ?? true
        : true
      
      if (passesCondition) {
        return foundTabIndex
      }
    }
    
    return null
  }, [isRootLevelTabs, getSubTabHashFromURL, tabs])

  const [activeTabIndex, setActiveTabIndex] = useState<number>(0)

  const activeTabInfo = tabStates[activeTabIndex]
  const activeTabConfig = activeTabInfo?.tab
  const activeTabDescription = activeTabConfig.admin?.description ?? activeTabConfig.description

  const activeTabStaticDescription =
    typeof activeTabDescription === 'function'
      ? activeTabDescription({ i18n, t: i18n.t })
      : activeTabDescription

  const hasVisibleTabs = tabStates.some(({ passesCondition }) => passesCondition)

  const handleTabChange = useCallback(
    (incomingTabIndex: number): void => {
      setActiveTabIndex(incomingTabIndex)

      // Update URL hash
      if (typeof window !== 'undefined') {
        const selectedTab = tabs[incomingTabIndex]
        const selectedTabHash = (selectedTab as any).hash

        if (isRootLevelTabs) {
          // For root level tabs, set the main hash (preserve any existing sub-hash)
          if (selectedTabHash) {
            const currentHash = window.location.hash.substring(1)
            const [, existingSubHash] = currentHash.split('-', 2)

            const newHash = existingSubHash ? `${selectedTabHash}-${existingSubHash}` : selectedTabHash
            window.history.replaceState(null, '', `#${newHash}`)
          } else {
            // Clear hash if tab has no hash value
            window.history.replaceState(null, '', window.location.pathname + window.location.search)
          }
        } else {
          // For nested tabs, update the sub-hash part
          if (selectedTabHash) {
            const currentHash = window.location.hash.substring(1)
            const [existingMainHash] = currentHash.split('-', 2)

            if (existingMainHash) {
              const newHash = `${existingMainHash}-${selectedTabHash}`
              window.history.replaceState(null, '', `#${newHash}`)
            } else {
              // Fallback: just set the sub-hash
              window.history.replaceState(null, '', `#${selectedTabHash}`)
            }
          }
        }
      }
    },
    [tabs, isRootLevelTabs],
  )

  // Track if we've done initial setup to avoid overriding manual tab changes
  const [hasInitialized, setHasInitialized] = useState(false)
  const [isHydrated, setIsHydrated] = useState(false)

  // Handle hydration
  useEffect(() => {
    setIsHydrated(true)
  }, [])

  // Handle initial tab selection based on hash or first visible tab
  useEffect(() => {
    // Only run initial setup once when tabStates are available and we're hydrated
    if (hasInitialized || tabStates.length === 0 || !isHydrated) {
      return
    }

    // Check for hash-based tab selection
    const hashTabIndex = isRootLevelTabs
      ? getTabIndexFromHash(tabStates)
      : getNestedTabIndexFromHash(tabStates)

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
  }, [tabStates, tabs, getTabIndexFromHash, getNestedTabIndexFromHash, activeTabIndex, isRootLevelTabs, hasInitialized, isHydrated])

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
      const hashTabIndex = isRootLevelTabs
        ? getTabIndexFromHash(tabStates)
        : getNestedTabIndexFromHash(tabStates)

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
  }, [getTabIndexFromHash, getNestedTabIndexFromHash, activeTabIndex, tabStates, isRootLevelTabs])

  // Also check hash on every render (for Next.js navigation that doesn't trigger hashchange)
  useEffect(() => {
    if (!isHydrated || tabStates.length === 0 || typeof window === 'undefined') {
      return
    }

    const hashTabIndex = isRootLevelTabs
      ? getTabIndexFromHash(tabStates)
      : getNestedTabIndexFromHash(tabStates)

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
