'use client'
import type {
  ClientField,
  ClientTab,
  DocumentPreferences,
  SanitizedFieldPermissions,
  StaticDescription,
  TabsFieldClientComponent,
} from 'payload'

import { getTranslation } from '@payloadcms/translations'
import { tabHasName, toKebabCase } from 'payload/shared'
import React, { useCallback, useEffect, useState } from 'react'

import { useCollapsible } from '../../elements/Collapsible/provider.js'
import { RenderCustomComponent } from '../../elements/RenderCustomComponent/index.js'
import { useFormFields } from '../../forms/Form/index.js'
import { RenderFields } from '../../forms/RenderFields/index.js'
import { useField } from '../../forms/useField/index.js'
import { withCondition } from '../../forms/withCondition/index.js'
import { useDocumentInfo } from '../../providers/DocumentInfo/index.js'
import { usePreferences } from '../../providers/Preferences/index.js'
import { useTranslation } from '../../providers/Translation/index.js'
import { FieldDescription } from '../FieldDescription/index.js'
import { fieldBaseClass } from '../shared/index.js'
import { TabsProvider } from './provider.js'
import { TabComponent } from './Tab/index.js'
import './index.scss'

const baseClass = 'tabs-field'

export { TabsProvider }

function generateTabPath({ activeTabConfig, path }: { activeTabConfig: ClientTab; path: string }) {
  let tabPath = path

  if (tabHasName(activeTabConfig) && activeTabConfig.name) {
    if (path) {
      tabPath = `${path}.${activeTabConfig.name}`
    } else {
      tabPath = activeTabConfig.name
    }
  }

  return tabPath
}

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
  } = props

  const { getPreference, setPreference } = usePreferences()
  const { preferencesKey } = useDocumentInfo()
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
  // Root level tabs have empty parentPath, regardless of whether they have a path
  const isRootLevelTabs = !parentPath
  
  // Helper function to get tab index from URL hash
  const getTabIndexFromHash = useCallback((currentTabStates?: Array<{ index: number; passesCondition: boolean; tab: ClientTab }>) => {
    // Only handle hash navigation for root-level tabs and when in browser environment
    if (!isRootLevelTabs || typeof window === 'undefined') {
      console.log('[Tabs] Skipping hash navigation - not root level tabs (parentPath:', parentPath, ', path:', path, ') or SSR')
      return null
    }
    
    // Debug: Log available tabs and their hash values
    console.log('[Tabs] Available tabs for hash navigation:', tabs.map((tab, index) => ({
      canUseHash: !!(tab as any).hash,
      hash: (tab as any).hash || 'no-hash',
      hasHash: !!(tab as any).hash,
      index
    })))
    
    const tabsWithHashes = tabs.filter(tab => !!(tab as any).hash)
    console.log('[Tabs] Only tabs with hash values can use hash navigation:', tabsWithHashes.length, 'of', tabs.length)
    
    if (typeof window !== 'undefined' && window.location.hash) {
      const hashTabValue = window.location.hash.substring(1) // Remove the # symbol
      console.log('[Tabs] Checking hash navigation for tab hash:', hashTabValue)
      
      const foundTabIndex = tabs.findIndex((tab) => 
        (tab as any).hash && (tab as any).hash === hashTabValue
      )
      
      console.log('[Tabs] Found tab index:', foundTabIndex, 'for hash:', hashTabValue)
      
      if (foundTabIndex !== -1) {
        // Check if the tab passes condition using provided tabStates or fallback to true
        const passesCondition = currentTabStates 
          ? currentTabStates[foundTabIndex]?.passesCondition ?? true
          : true
        
        console.log('[Tabs] Tab passes condition:', passesCondition)
        
        if (passesCondition) {
          console.log('[Tabs] Selecting tab from hash:', foundTabIndex)
          return foundTabIndex
        }
      }
    } else {
      console.log('[Tabs] No hash in URL or not in browser environment')
    }
    return null
  }, [tabs, isRootLevelTabs, parentPath, path])

  const [activeTabIndex, setActiveTabIndex] = useState<number>(0)

  const tabsPrefKey = `tabs-${indexPath}`
  const [activeTabPath, setActiveTabPath] = useState<string>(() =>
    generateTabPath({ activeTabConfig: tabs[activeTabIndex], path: parentPath }),
  )

  const [activeTabSchemaPath, setActiveTabSchemaPath] = useState<string>(() =>
    generateTabPath({ activeTabConfig: tabs[activeTabIndex], path: parentSchemaPath }),
  )

  const activePathChildrenPath = tabHasName(tabs[activeTabIndex]) ? activeTabPath : parentPath
  const activeTabInfo = tabStates[activeTabIndex]
  const activeTabConfig = activeTabInfo?.tab
  const activePathSchemaChildrenPath = tabHasName(tabs[activeTabIndex])
    ? activeTabSchemaPath
    : parentSchemaPath

  const activeTabDescription = activeTabConfig.admin?.description ?? activeTabConfig.description

  const activeTabStaticDescription =
    typeof activeTabDescription === 'function'
      ? activeTabDescription({ i18n, t: i18n.t })
      : activeTabDescription

  const hasVisibleTabs = tabStates.some(({ passesCondition }) => passesCondition)

  const handleTabChange = useCallback(
    async (incomingTabIndex: number): Promise<void> => {
      console.log('[Tabs] Manual tab change to index:', incomingTabIndex)
      setActiveTabIndex(incomingTabIndex)

      setActiveTabPath(
        generateTabPath({ activeTabConfig: tabs[incomingTabIndex], path: parentPath }),
      )
      setActiveTabSchemaPath(
        generateTabPath({ activeTabConfig: tabs[incomingTabIndex], path: parentSchemaPath }),
      )

      // Update URL hash for root-level tabs when manually switching
      if (isRootLevelTabs && typeof window !== 'undefined') {
        const selectedTab = tabs[incomingTabIndex]
        if ((selectedTab as any).hash) {
          console.log('[Tabs] Updating URL hash to:', (selectedTab as any).hash)
          window.history.replaceState(null, '', `#${(selectedTab as any).hash}`)
        } else {
          // Clear hash if tab has no hash value
          console.log('[Tabs] Clearing URL hash - selected tab has no hash value')
          window.history.replaceState(null, '', window.location.pathname + window.location.search)
        }
      }

      // Save tab selection to user preferences
      if (preferencesKey) {
        console.log('[Tabs] Saving tab preference. Tab index:', incomingTabIndex, 'Preference key:', path || tabsPrefKey)
        const existingPreferences: DocumentPreferences = await getPreference(preferencesKey)

        await setPreference(preferencesKey, {
          ...existingPreferences,
          ...(path
            ? {
                fields: {
                  ...(existingPreferences?.fields || {}),
                  [path]: {
                    ...existingPreferences?.fields?.[path],
                    tabIndex: incomingTabIndex,
                  },
                },
              }
            : {
                fields: {
                  ...existingPreferences?.fields,
                  [tabsPrefKey]: {
                    ...existingPreferences?.fields?.[tabsPrefKey],
                    tabIndex: incomingTabIndex,
                  },
                },
              }),
        })
        console.log('[Tabs] Tab preference saved successfully')
      } else {
        console.log('[Tabs] No preference key - skipping preference save')
      }
    },
    [
      tabs,
      parentPath,
      parentSchemaPath,
      getPreference,
      preferencesKey,
      setPreference,
      path,
      tabsPrefKey,
      isRootLevelTabs,
    ],
  )

  // Track if we've done initial setup to avoid overriding manual tab changes
  const [hasInitialized, setHasInitialized] = useState(false)
  const [isHydrated, setIsHydrated] = useState(false)

  // Handle hydration
  useEffect(() => {
    setIsHydrated(true)
  }, [])

  // Handle initial tab selection based on hash or preferences (after hydration)
  useEffect(() => {
    // Only run initial setup once when tabStates are available and we're hydrated
    if (hasInitialized || tabStates.length === 0 || !isHydrated) {
      return
    }

    console.log('[Tabs] Initial tab selection. isRootLevelTabs:', isRootLevelTabs, 'activeTabIndex:', activeTabIndex)
    
    // First check URL hash for tab selection (with proper condition checking)
    const hashTabIndex = getTabIndexFromHash(tabStates)
    if (hashTabIndex !== null) {
      console.log('[Tabs] Initial hash-based tab selection:', hashTabIndex)
      if (activeTabIndex !== hashTabIndex) {
        console.log('[Tabs] Switching to hash-based tab:', hashTabIndex)
        setActiveTabIndex(hashTabIndex)
        setActiveTabPath(generateTabPath({ activeTabConfig: tabs[hashTabIndex], path: parentPath }))
        setActiveTabSchemaPath(
          generateTabPath({ activeTabConfig: tabs[hashTabIndex], path: parentSchemaPath }),
        )
      }
      setHasInitialized(true)
      return
    }

    // If no hash, use preferences or fall back to first visible tab
    if (preferencesKey) {
      console.log('[Tabs] Using preferences for initial tab selection. Preference key:', preferencesKey)
      const getInitialPref = async () => {
        const existingPreferences: DocumentPreferences = await getPreference(preferencesKey)
        console.log('[Tabs] Loaded preferences:', existingPreferences)
        
        const initialIndex = path
          ? existingPreferences?.fields?.[path]?.tabIndex
          : existingPreferences?.fields?.[tabsPrefKey]?.tabIndex

        const preferredIndex = initialIndex || 0
        console.log('[Tabs] Preferred tab index from preferences:', preferredIndex, '(raw value:', initialIndex, ')')
        
        // Make sure the preferred tab is visible, otherwise use first visible
        const finalIndex = tabStates[preferredIndex]?.passesCondition 
          ? preferredIndex 
          : tabStates.find(({ passesCondition }) => passesCondition)?.index ?? 0

        console.log('[Tabs] Final tab index after condition check:', finalIndex)

        if (activeTabIndex !== finalIndex) {
          console.log('[Tabs] Switching to preference-based tab:', finalIndex)
          setActiveTabIndex(finalIndex)
          setActiveTabPath(generateTabPath({ activeTabConfig: tabs[finalIndex], path: parentPath }))
          setActiveTabSchemaPath(
            generateTabPath({ activeTabConfig: tabs[finalIndex], path: parentSchemaPath }),
          )
        }
        setHasInitialized(true)
      }
      void getInitialPref()
    } else {
      // No preferences, just use first visible tab
      const firstVisibleIndex = tabStates.find(({ passesCondition }) => passesCondition)?.index ?? 0
      console.log('[Tabs] No preferences, using first visible tab:', firstVisibleIndex)
      
      if (activeTabIndex !== firstVisibleIndex) {
        console.log('[Tabs] Switching to first visible tab:', firstVisibleIndex)
        setActiveTabIndex(firstVisibleIndex)
        setActiveTabPath(generateTabPath({ activeTabConfig: tabs[firstVisibleIndex], path: parentPath }))
        setActiveTabSchemaPath(
          generateTabPath({ activeTabConfig: tabs[firstVisibleIndex], path: parentSchemaPath }),
        )
      }
      setHasInitialized(true)
    }
  }, [tabStates, path, getPreference, preferencesKey, tabsPrefKey, tabs, parentPath, parentSchemaPath, getTabIndexFromHash, activeTabIndex, isRootLevelTabs, hasInitialized, isHydrated])

  useEffect(() => {
    if (activeTabInfo?.passesCondition === false) {
      const nextTab = tabStates.find(({ passesCondition }) => passesCondition)
      if (nextTab) {
        void handleTabChange(nextTab.index)
      }
    }
  }, [activeTabInfo, tabStates, handleTabChange])

  // Listen for hash changes to update active tab
  useEffect(() => {
    const handleHashChange = () => {
      console.log('[Tabs] Hash change detected. isRootLevelTabs:', isRootLevelTabs)
      const hashTabIndex = getTabIndexFromHash(tabStates)
      if (hashTabIndex !== null && hashTabIndex !== activeTabIndex) {
        console.log('[Tabs] Hash change - switching to tab:', hashTabIndex)
        setActiveTabIndex(hashTabIndex)
        setActiveTabPath(generateTabPath({ activeTabConfig: tabs[hashTabIndex], path: parentPath }))
        setActiveTabSchemaPath(
          generateTabPath({ activeTabConfig: tabs[hashTabIndex], path: parentSchemaPath }),
        )
      }
    }

    if (typeof window !== 'undefined' && isRootLevelTabs) {
      console.log('[Tabs] Setting up hash change listener for root-level tabs')
      window.addEventListener('hashchange', handleHashChange)
      return () => {
        console.log('[Tabs] Cleaning up hash change listener')
        window.removeEventListener('hashchange', handleHashChange)
      }
    }
  }, [getTabIndexFromHash, activeTabIndex, tabs, parentPath, parentSchemaPath, tabStates, isRootLevelTabs])

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
                  void handleTabChange(index)
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
              fields={activeTabConfig.fields}
              forceRender={forceRender}
              hidden={false}
              parentIndexPath={
                tabHasName(activeTabConfig)
                  ? ''
                  : `${indexPath ? indexPath + '-' : ''}` + String(activeTabInfo.index)
              }
              parentPath={activePathChildrenPath}
              parentSchemaPath={activePathSchemaChildrenPath}
              path={activeTabPath}
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
  readonly fields: ClientField[]
  readonly forceRender?: boolean
  readonly hidden: boolean
  readonly label?: string
  readonly parentIndexPath: string
  readonly parentPath: string
  readonly parentSchemaPath: string
  readonly path: string
  readonly permissions: SanitizedFieldPermissions
  readonly readOnly: boolean
}

function TabContent({
  description,
  fields,
  forceRender,
  hidden,
  label,
  parentIndexPath,
  parentPath,
  parentSchemaPath,
  permissions,
  readOnly,
}: ActiveTabProps) {
  const { i18n } = useTranslation()

  const { customComponents: { AfterInput, BeforeInput, Description, Field } = {}, path } =
    useField()

  if (Field) {
    return Field
  }

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
          <FieldDescription description={description} marginPlacement="bottom" path={path} />
        }
      />
      {BeforeInput}
      <RenderFields
        fields={fields}
        forceRender={forceRender}
        parentIndexPath={parentIndexPath}
        parentPath={parentPath}
        parentSchemaPath={parentSchemaPath}
        permissions={permissions}
        readOnly={readOnly}
      />
      {AfterInput}
    </div>
  )
}
