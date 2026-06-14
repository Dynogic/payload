import { createServerFeature } from '../../../utilities/createServerFeature.js'
import { SUBSCRIPT } from './markdownTransformers.js'

export const SubscriptFeature = createServerFeature({
  feature: {
    ClientFeature: '@payloadcms/richtext-lexical/client#SubscriptFeatureClient',
    markdownTransformers: [SUBSCRIPT],
  },
  key: 'subscript',
})
