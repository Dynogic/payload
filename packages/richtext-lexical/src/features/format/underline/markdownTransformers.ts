import type { TextFormatTransformer } from '../../../packages/@lexical/markdown/MarkdownTransformers.js'

export const UNDERLINE: TextFormatTransformer = {
  type: 'text-format',
  format: ['underline'],
  tag: '++',
}
