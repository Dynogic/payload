import type {
  Data,
  DefaultDocumentIDType,
  FilterOptionsResult,
  FormState,
  Operation,
} from 'payload'
import type React from 'react'
import type { HTMLAttributes } from 'react'

import type { Props as DrawerProps } from '../Drawer/types.js'
import type { DocumentDrawerContextProps } from './Provider.js'

export type DocumentDrawerProps = {
  readonly AfterFields?: React.ReactNode
  /**
   * Restrict file uploads to specific MIME types (e.g., ['video/*', 'image/*']).
   * Passed to the Upload component inside the drawer.
   */
  readonly allowedMimeTypes?: string[]
  /**
   * The slug of the collection to which the document belongs.
   */
  readonly collectionSlug: string
  readonly disableActions?: boolean
  /**
   * Arbitrary context data accessible to custom field components via useDocumentDrawerContext().
   * Useful for passing filters or configuration from the parent that opened the drawer.
   */
  readonly drawerContext?: Record<string, unknown>
  readonly drawerSlug?: string
  readonly filterOptions?: FilterOptionsResult
  /**
   * The ID of the document to be edited.
   * When provided, will be fetched and displayed in the drawer.
   * If omitted, will render the "create new" view for the given collection.
   */
  readonly id?: DefaultDocumentIDType | null
  readonly initialData?: Data
  /**
   * @deprecated
   */
  readonly initialState?: FormState
  readonly overrideEntityVisibility?: boolean
  readonly redirectAfterCreate?: boolean
  readonly redirectAfterDelete?: boolean
  readonly redirectAfterDuplicate?: boolean
  readonly redirectAfterRestore?: boolean
} & Pick<DocumentDrawerContextProps, 'onDelete' | 'onDuplicate' | 'onSave'> &
  Pick<DrawerProps, 'Header'>

export type DocumentTogglerProps = {
  readonly children?: React.ReactNode
  readonly className?: string
  readonly collectionSlug: string
  readonly disabled?: boolean
  readonly drawerSlug?: string
  readonly onClick?: () => void
  readonly operation: Operation
} & Readonly<HTMLAttributes<HTMLButtonElement>>

export type UseDocumentDrawerContext = {
  closeDrawer: () => void
  drawerDepth: number
  drawerSlug: string
  isDrawerOpen: boolean
  openDrawer: () => void
  toggleDrawer: () => void
}

export type UseDocumentDrawer = (
  args: Pick<
    DocumentDrawerProps,
    'collectionSlug' | 'filterOptions' | 'id' | 'overrideEntityVisibility'
  >,
) => [
  // drawer
  React.FC<
    {
      children?: React.ReactNode
    } & Omit<DocumentDrawerProps, 'collectionSlug' | 'operation'>
  >,
  // toggler
  React.FC<
    {
      children?: React.ReactNode
    } & Omit<DocumentTogglerProps, 'collectionSlug' | 'operation'>
  >,
  // context
  UseDocumentDrawerContext,
]
