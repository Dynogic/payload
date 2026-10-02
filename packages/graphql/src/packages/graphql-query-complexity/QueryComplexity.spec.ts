import {
  GraphQLBoolean,
  GraphQLInt,
  GraphQLList,
  GraphQLObjectType,
  GraphQLSchema,
  GraphQLString,
  parse,
} from 'graphql'
import { describe, expect, it } from 'vitest'

import type { ComplexityEstimator } from './QueryComplexity.js'

import { getComplexity } from './QueryComplexity.js'

// Fork #114: graphql 17 changed `getVariableValues` to return `{ variableValues: { sources, coerced } }`
// and made `getArgumentValues` / `getDirectiveValues` take that object. These cases prove the rule
// reads variables through arguments and @include / @skip on whichever graphql is installed.

const Item = new GraphQLObjectType({
  name: 'Item',
  fields: { name: { type: GraphQLString } },
})

const schema = new GraphQLSchema({
  query: new GraphQLObjectType({
    name: 'Query',
    fields: {
      flag: { type: GraphQLBoolean },
      items: { type: new GraphQLList(Item), args: { limit: { type: GraphQLInt } } },
      other: { type: GraphQLString },
    },
  }),
})

const seenArgs: Record<string, unknown>[] = []

// A list field costs `limit` times its children; every other field costs 1.
const estimator: ComplexityEstimator = ({ args, childComplexity, field }) => {
  if (field.name === 'items') {
    seenArgs.push({ ...args })
    return (args.limit ?? 1) * Math.max(childComplexity, 1)
  }
  return 1 + childComplexity
}

const query = parse(/* GraphQL */ `
  query Items($limit: Int, $show: Boolean!, $hide: Boolean!) {
    items(limit: $limit) @include(if: $show) {
      name
    }
    other @skip(if: $hide)
  }
`)

describe('QueryComplexity (fork #114)', () => {
  it('reads argument values from variables', () => {
    seenArgs.length = 0
    const complexity = getComplexity({
      estimators: [estimator],
      query,
      schema,
      variables: { hide: false, limit: 5, show: true },
    })

    expect(seenArgs).toEqual([{ limit: 5 }])
    // items: 5 * name(1) = 5, other: 1
    expect(complexity).toBe(6)
  })

  it('applies @include and @skip from variables', () => {
    seenArgs.length = 0
    const complexity = getComplexity({
      estimators: [estimator],
      query,
      schema,
      variables: { hide: true, limit: 5, show: false },
    })

    expect(seenArgs).toEqual([])
    expect(complexity).toBe(0)
  })

  it('reports invalid variables instead of throwing a TypeError', () => {
    expect(() =>
      getComplexity({
        estimators: [estimator],
        query,
        schema,
        variables: { hide: false, limit: 'many', show: true },
      }),
    ).toThrow(/limit/)
  })
})
