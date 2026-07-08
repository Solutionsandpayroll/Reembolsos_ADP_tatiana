import type { ImageFile, ExtractionStats, ZipStructure } from '../types'

const IMAGE_EXTENSIONS = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.bmp',
  '.webp',
  '.tiff',
  '.tif',
])

export function isImage(filename: string): boolean {
  const ext = filename.toLowerCase().slice(filename.lastIndexOf('.'))
  return IMAGE_EXTENSIONS.has(ext)
}
