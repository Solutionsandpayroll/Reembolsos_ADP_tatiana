/**
 * Servicio de generación y división de PDFs.
 *
 * Responsabilidades:
 *  - Generar un PDF único con una imagen por página usando pdf-lib
 *  - Ajustar orientación y tamaño de página según cada imagen
 *  - Liberar buffers de imagen inmediatamente tras embeber (control de memoria)
 *  - Dividir el PDF en dos (PDF A: páginas seleccionadas, PDF B: resto)
 *  - Descargar PDFs con manejo de bloqueo de múltiples descargas
 *  - Reportar progreso durante generación y división
 */

import { PDFDocument, PageSizes } from 'pdf-lib'
import type { ImageFile, SplitResult } from '../types'

export type ProgressCallback = (current: number, total: number) => void

const MAX_PAGE_DIMENSION = 14400
const A4_LANDSCAPE_WIDTH = PageSizes.A4[1]
const A4_LANDSCAPE_HEIGHT = PageSizes.A4[0]

function calculatePageSize(imgWidth: number, imgHeight: number): [number, number] {
  if (imgWidth <= MAX_PAGE_DIMENSION && imgHeight <= MAX_PAGE_DIMENSION) {
    return [imgWidth, imgHeight]
  }
  const scale = Math.min(
    A4_LANDSCAPE_WIDTH / imgWidth,
    A4_LANDSCAPE_HEIGHT / imgHeight,
    1
  )
  return [Math.floor(imgWidth * scale), Math.floor(imgHeight * scale)]
}

function getImageType(filename: string): 'png' | 'jpg' {
  const ext = filename.toLowerCase().split('.').pop()
  return ext === 'png' ? 'png' : 'jpg'
}

export async function generatePdf(
  images: ImageFile[],
  onProgress?: ProgressCallback
): Promise<Uint8Array> {
  if (images.length === 0) {
    throw new Error('No hay imágenes para generar el PDF')
  }

  const pdfDoc = await PDFDocument.create()

  for (let i = 0; i < images.length; i++) {
    const img = images[i]

    if (!img.buffer || img.buffer.byteLength === 0) {
      console.warn(`Imagen sin datos, omitiendo: ${img.filename}`)
      onProgress?.(i + 1, images.length)
      continue
    }

    const type = getImageType(img.filename)

    let embeddedImage
    try {
      embeddedImage = type === 'png'
        ? await pdfDoc.embedPng(img.buffer)
        : await pdfDoc.embedJpg(img.buffer)
    } catch (err) {
      console.warn(`No se pudo embeber la imagen: ${img.filename}`, err)
      onProgress?.(i + 1, images.length)
      continue
    }

    const [pageWidth, pageHeight] = calculatePageSize(
      embeddedImage.width,
      embeddedImage.height
    )

    const page = pdfDoc.addPage([pageWidth, pageHeight])
    page.drawImage(embeddedImage, {
      x: 0,
      y: 0,
      width: pageWidth,
      height: pageHeight,
    })

    img.buffer = new ArrayBuffer(0)

    onProgress?.(i + 1, images.length)
  }

  if (pdfDoc.getPageCount() === 0) {
    throw new Error('No se pudo generar ninguna página en el PDF')
  }

  return pdfDoc.save()
}

export async function splitPdf(
  pdfBytes: Uint8Array,
  selectedIndices: Set<number>,
  onProgress?: ProgressCallback
): Promise<SplitResult> {
  const sourceDoc = await PDFDocument.load(pdfBytes)
  const docA = await PDFDocument.create()
  const docB = await PDFDocument.create()

  const pageCount = sourceDoc.getPageCount()
  const totalPages = pageCount

  for (let i = 0; i < pageCount; i++) {
    if (selectedIndices.has(i)) {
      const [copiedPage] = await docA.copyPages(sourceDoc, [i])
      docA.addPage(copiedPage)
    } else {
      const [copiedPage] = await docB.copyPages(sourceDoc, [i])
      docB.addPage(copiedPage)
    }
    onProgress?.(i + 1, totalPages)
  }

  const [pdfA, pdfB] = await Promise.all([
    docA.save(),
    docB.save(),
  ])

  return {
    pdfA,
    pdfB,
    pageCountA: docA.getPageCount(),
    pageCountB: docB.getPageCount(),
  }
}

export async function downloadPdfsSequential(
  pdfs: { bytes: Uint8Array; filename: string }[]
): Promise<void> {
  for (let i = 0; i < pdfs.length; i++) {
    const { bytes, filename } = pdfs[i]

    const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    await new Promise((resolve) => setTimeout(resolve, 300))

    URL.revokeObjectURL(url)
  }
}

export function downloadPdf(bytes: Uint8Array, filename: string): void {
  const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
