import React from 'react'
import { FileIcon } from '../../../icons/File/index.js'
import { ImageIcon } from '../../../icons/Image/index.js'
import { VideoIcon } from '../../../icons/Video/index.js'

export const getFileIcon = (mimeType?: string) => {
  if (!mimeType) return <FileIcon />
  
  if (mimeType.startsWith('image/')) {
    return <ImageIcon />
  }
  
  if (mimeType.startsWith('video/')) {
    return <VideoIcon />
  }
  
  return <FileIcon />
}