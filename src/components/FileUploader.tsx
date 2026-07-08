import { useState, useCallback, useRef, type DragEvent, type ChangeEvent } from 'react'
import { MAX_FILE_SIZE_MB } from '../constants'

interface FileUploaderProps {
  onFilesSelected: (files: File[]) => void
  disabled?: boolean
}

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function FileUploader({ onFilesSelected, disabled = false }: FileUploaderProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [warnings, setWarnings] = useState<string[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const filterZipFiles = (fileList: FileList | File[]): { zipFiles: File[]; warnings: string[] } => {
    const warnings: string[] = []
    const zipFiles: File[] = []

    for (const file of Array.from(fileList)) {
      const isZip = file.name.toLowerCase().endsWith('.zip') || file.type === 'application/zip'

      if (!isZip) {
        warnings.push(`"${file.name}" fue ignorado (no es un archivo .zip)`)
        continue
      }

      if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
        warnings.push(
          `"${file.name}" pesa ${formatSize(file.size)}, más de ${MAX_FILE_SIZE_MB} MB. Puede tardar en procesarse.`
        )
      }

      zipFiles.push(file)
    }

    return { zipFiles, warnings }
  }

  const handleFiles = useCallback(
    (files: File[]) => {
      const { zipFiles, warnings: newWarnings } = filterZipFiles(files)
      setWarnings(newWarnings)
      if (zipFiles.length > 0) {
        onFilesSelected(zipFiles)
      }
    },
    [onFilesSelected]
  )

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragging(false)
      if (!disabled && e.dataTransfer.files.length > 0) {
        handleFiles(Array.from(e.dataTransfer.files))
      }
    },
    [disabled, handleFiles]
  )

  const handleDragOver = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      e.stopPropagation()
      if (!disabled) setIsDragging(true)
    },
    [disabled]
  )

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }, [])

  const handleInputChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        handleFiles(Array.from(e.target.files))
      }
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    },
    [handleFiles]
  )

  const handleClick = useCallback(() => {
    if (!disabled && fileInputRef.current) {
      fileInputRef.current.click()
    }
  }, [disabled])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        handleClick()
      }
    },
    [handleClick]
  )

  return (
    <div>
      <div
        className={`drop-zone ${isDragging ? 'drag-active' : ''}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
      >
        <div className="drop-zone-icon">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
        </div>
        <p className="drop-zone-text">
          {isDragging
            ? 'Suelta los archivos aquí'
            : 'Arrastra archivos .zip aquí o haz clic para seleccionarlos'}
        </p>
        <p className="drop-zone-hint">
          Tamaño máximo recomendado: {MAX_FILE_SIZE_MB} MB por archivo
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".zip,application/zip"
          multiple
          onChange={handleInputChange}
          style={{ display: 'none' }}
          aria-hidden="true"
        />
      </div>

      {warnings.length > 0 && (
        <div className="upload-warnings">
          {warnings.map((w, i) => (
            <p key={i} className="upload-warning">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              {w}
            </p>
          ))}
        </div>
      )}
    </div>
  )
}
