/**
 * Utilidades para gestión de memoria.
 * En el navegador, no podemos forzar GC explícitamente,
 * pero podemos liberar referencias y usar ArrayBuffer transferibles.
 */

export function releaseBuffer(buffer: ArrayBuffer | null): void {
  if (!buffer) return
  new Uint8Array(buffer).fill(0)
}

export function estimateMemoryUsage(images: { size: number }[]): number {
  return images.reduce((sum, img) => sum + img.size, 0)
}
