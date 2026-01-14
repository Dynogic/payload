import { createServerFeature } from '../../../utilities/createServerFeature.js'
import { HIGHLIGHT } from './markdownTransformers.js'

export const HighlightFeature = createServerFeature({
  feature: {
    ClientFeature: '@payloadcms/richtext-lexical/client#HighlightFeatureClient',

    markdownTransformers: [HIGHLIGHT],
  },
  key: 'highlight',
})
