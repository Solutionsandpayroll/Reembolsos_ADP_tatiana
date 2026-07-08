/**
 * Prueba rápida de la extracción recursiva
 * Valida que las estadísticas y la extracción profunda funcionen correctamente
 */

import JSZip from 'jszip'
import { readFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// Versión simplificada de extractImagesRecursive para probar la lógica
function analyzeStructure(zip) {
  const files = []
  const folders = []
  const nestedZips = []
  const images = []

  const IMG_EXTS = new Set(['.jpg','.jpeg','.png','.gif','.bmp','.webp','.tiff','.tif'])
  const isImage = (f) => IMG_EXTS.has(f.toLowerCase().slice(f.lastIndexOf('.')))

  zip.forEach((path, entry) => {
    if (entry.dir) {
      folders.push(path)
    } else {
      files.push(path)
      if (path.toLowerCase().endsWith('.zip')) nestedZips.push(path)
      else if (isImage(path)) images.push(path)
    }
  })

  return { files, folders, nestedZips, images }
}

async function extractRecursive(zip, stats, depth = 0, prefix = '') {
  const images = []
  const structure = analyzeStructure(zip)

  stats.totalFiles += structure.files.length
  stats.totalFolders += structure.folders.length
  stats.totalNestedZips += structure.nestedZips.length
  stats.maxDepth = Math.max(stats.maxDepth, depth)

  for (const imgPath of structure.images) {
    const entry = zip.file(imgPath)
    if (!entry) continue
    const data = await entry.async('nodebuffer')
    const fullPath = prefix ? `${prefix}/${imgPath}` : imgPath
    images.push({
      path: fullPath,
      filename: imgPath.split('/').pop(),
      size: data.length,
      depth,
    })
    stats.totalImages++
  }

  for (const nestedPath of structure.nestedZips) {
    const entry = zip.file(nestedPath)
    if (!entry) continue
    const nestedPrefix = prefix ? `${prefix}/${nestedPath}` : nestedPath
    try {
      const buffer = await entry.async('nodebuffer')
      if (buffer.length === 0) continue
      const nested = await JSZip.loadAsync(buffer)
      const nestedImages = await extractRecursive(nested, stats, depth + 1, nestedPrefix)
      images.push(...nestedImages)
    } catch (err) {
      console.warn(`  ⚠ ZIP anidado corrupto: ${nestedPath}`)
    }
  }

  return images
}

async function testZip(filePath) {
  console.log(`\n📦 Probando: ${filePath}`)
  const raw = readFileSync(filePath)
  console.log(`   Tamaño: ${formatSize(raw.length)}`)

  const zip = await JSZip.loadAsync(raw)
  const stats = { totalFiles: 0, totalFolders: 0, totalNestedZips: 0, totalImages: 0, maxDepth: 0 }

  const start = Date.now()
  const images = await extractRecursive(zip, stats)
  const elapsed = Date.now() - start

  console.log(`   Imágenes encontradas: ${images.length}`)
  console.log(`   Archivos totales: ${stats.totalFiles}`)
  console.log(`   Carpetas: ${stats.totalFolders}`)
  console.log(`   ZIPs anidados: ${stats.totalNestedZips}`)
  console.log(`   Profundidad máxima: ${stats.maxDepth}`)
  console.log(`   Tiempo: ${elapsed}ms`)

  // Mostrar las primeras 5 imágenes encontradas
  const preview = images.slice(0, 5)
  console.log(`   Primeras ${preview.length} imágenes:`)
  for (const img of preview) {
    console.log(`     [prof=${img.depth}] ${img.path} (${formatSize(img.size)})`)
  }
  if (images.length > 5) console.log(`     ... y ${images.length - 5} más`)

  return { stats, images }
}

async function main() {
  const testDir = join(__dirname, 'test-data')
  const files = [
    join(testDir, 'test-case1-nested-zips.zip'),
    join(testDir, 'test-case2-flat-folders.zip'),
  ]

  for (const f of files) {
    if (existsSync(f)) {
      await testZip(f)
    }
  }

  // También probar con ZIPs reales si existen
  const projectRoot = join(__dirname, '..', '..')
  const realZips = [
    join(projectRoot, 'soportes (2) (3).zip'),
    join(projectRoot, 'soportes faltantes 1.zip'),
  ]

  for (const f of realZips) {
    if (existsSync(f)) {
      await testZip(f)
    }
  }
}

main().catch(console.error)
