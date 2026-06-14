import { createServerFeature } from '../../../utilities/createServerFeature.js'
import { SUPERSCRIPT } from './markdownTransformers.js'

export const SuperscriptFeature = createServerFeature({
  feature: {
    ClientFeature: '@payloadcms/richtext-lexical/client#SuperscriptFeatureClient',
    markdownTransformers: [SUPERSCRIPT],
  },
  key: 'superscript',
})
