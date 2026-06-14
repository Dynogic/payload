import { createServerFeature } from '../../../utilities/createServerFeature.js'
import { UNDERLINE } from './markdownTransformers.js'

export const UnderlineFeature = createServerFeature({
  feature: {
    ClientFeature: '@payloadcms/richtext-lexical/client#UnderlineFeatureClient',
    markdownTransformers: [UNDERLINE],
  },
  key: 'underline',
})
