import type { FilterOptionsResult, ValueWithRelation } from 'payload'

export type Props = {
  readonly Button?: React.ReactNode
  readonly filterOptions?: FilterOptionsResult
  readonly path: string
  readonly relationTo: string | string[]
  readonly unstyled?: boolean
} & SharedRelationshipInputProps

type SharedRelationshipInputProps =
  | {
      readonly hasMany: false
      readonly onChange: (value: ValueWithRelation, modifyForm?: boolean) => void
      readonly value?: null | ValueWithRelation
    }
  | {
      readonly hasMany: true
      readonly onChange: (value: ValueWithRelation[]) => void
      readonly value?: null | ValueWithRelation[]
    }
