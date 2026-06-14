import type { TextFormatTransformer } from '../../../packages/@lexical/markdown/MarkdownTransformers.js'

export const SUBSCRIPT: TextFormatTransformer = {
  type: 'text-format',
  format: ['subscript'],
  tag: '~',
}
