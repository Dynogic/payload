import type { TextFormatTransformer } from '../../../packages/@lexical/markdown/MarkdownTransformers.js'

export const HIGHLIGHT: TextFormatTransformer = {
  type: 'text-format',
  format: ['highlight'],
  tag: '==',
}
