import type { TextFormatTransformer } from '../../../packages/@lexical/markdown/MarkdownTransformers.js'

export const SUPERSCRIPT: TextFormatTransformer = {
  type: 'text-format',
  format: ['superscript'],
  tag: '^',
}
