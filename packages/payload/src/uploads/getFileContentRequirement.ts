import type { SanitizedUploadConfig } from './types.js'

import { canResizeImage } from './canResizeImage.js'
import {
  isSvgMimeType,
  isXmlMimeType,
  uploadRequiresServerValidation,
} from './getFileTypeIdentity.js'
import { isAnimatedImage } from './isAnimatedImage.js'
import { isImage } from './isImage.js'

export const HEADER_PROBE_BYTE_LENGTH = 1024 * 1024

export type FileContentRequirement = 'full' | 'header' | 'none'

export function getFileContentRequirement({
  filename,
  hasSizeEdits,
  mimeType,
  uploadConfig,
}: {
  /** The upload's filename: an `.svg` / `.xml` name is checked whole whatever
   * its declared type (fork #126). */
  filename?: string
  hasSizeEdits?: boolean
  mimeType: string
  uploadConfig: SanitizedUploadConfig
}): FileContentRequirement {
  if (!uploadConfig.disableLocalStorage) {
    return 'full'
  }

  // FORK #126: the SVG / XML safety check (checkFileRestrictions) parses the
  // WHOLE document. A header read cut an SVG over 1 MB mid-document (refused
  // as "potentially harmful"), and an SVG declared `text/xml` got 'none'
  // (0 bytes: not recognised as SVG, so never inspected at all).
  if (
    filename
      ? uploadRequiresServerValidation({
          allowRestrictedFileTypes: uploadConfig.allowRestrictedFileTypes,
          filename,
          mimeType,
        })
      : !uploadConfig.allowRestrictedFileTypes &&
        (isSvgMimeType(mimeType) || isXmlMimeType(mimeType))
  ) {
    return 'full'
  }

  const hasMimeTypeAllowList =
    !uploadConfig.allowRestrictedFileTypes &&
    Array.isArray(uploadConfig.mimeTypes) &&
    uploadConfig.mimeTypes.length > 0

  if (hasMimeTypeAllowList) {
    return 'full'
  }

  const isResizableImage = canResizeImage(mimeType)
  const hasConfiguredAdjustments = Boolean(
    uploadConfig.resizeOptions ||
      uploadConfig.formatOptions ||
      uploadConfig.trimOptions ||
      uploadConfig.constructorOptions ||
      (Array.isArray(uploadConfig.imageSizes) && uploadConfig.imageSizes.length > 0),
  )

  if (hasSizeEdits || (isResizableImage && hasConfiguredAdjustments) || isAnimatedImage(mimeType)) {
    return 'full'
  }

  if (isResizableImage || isImage(mimeType)) {
    return 'header'
  }

  return 'none'
}
