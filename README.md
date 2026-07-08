# Conversor de ZIP a PDF — Reembolsos ADP

Aplicación web para **Solutions & Payroll** que convierte archivos ZIP con imágenes de soporte en PDFs organizados, completamente del lado del cliente (sin backend).

## Funcionamiento

1. **Cargar ZIPs** — Arrastrá o seleccioná uno o varios archivos `.zip`
2. **Procesar** — La app detecta automáticamente la estructura y extrae todas las imágenes
3. **Previsualizar** — Se genera un PDF con una imagen por página. Podés ver cada página con thumbnails reales
4. **Descargar** — Dos opciones:
   - **PDF completo**: descarga todas las páginas en un solo archivo
   - **Dividir en PDFs**: seleccioná páginas con checkboxes para generar PDF A (seleccionadas) + PDF B (restantes)

## Estructuras de ZIP soportadas

### Caso 1 — ZIPs anidados
```
Soportes.zip
├── Persona_001.zip
│   ├── Carpeta_A/
│   │   └── imagen.jpg
│   └── Carpeta_B/
│       └── imagen.jpg
├── Persona_002.zip
│   └── ...
```

### Caso 2 — Carpetas planas
```
Soportes.zip
├── Carpeta_A/
│   └── imagen.jpg
├── Carpeta_B/
│   └── imagen.jpg
```

La detección es automática: no hace falta indicar qué estructura tiene el ZIP. Soporta recursión a cualquier profundidad.

## Stack técnico

| Tecnología | Uso |
|---|---|
| **React 18** + **Vite 5** | UI y bundling |
| **TypeScript** | Tipado estático en todo el proyecto |
| **JSZip** | Lectura y extracción recursiva de ZIPs |
| **pdf-lib** | Generación y división de PDFs |
| **react-pdf** (PDF.js) | Vista previa de páginas con thumbnails reales |

## Arquitectura

```
src/
├── App.tsx                    # Orquestador de flujo (3 pasos)
├── types/                     # Interfaces TypeScript
│   ├── zip.types.ts           # ImageFile, ZipStructure, ExtractionStats
│   ├── pdf.types.ts           # PdfPageInfo, SplitResult
│   └── app.types.ts           # ProcessingProgress, AppState
├── services/                  # Lógica de negocio (sin UI)
│   ├── zipService.ts          # loadZip, extractImagesRecursive, analyzeStructure
│   └── pdfService.ts          # generatePdf, splitPdf, downloadPdf, downloadPdfsSequential
├── hooks/                     # Estado y orquestación
│   ├── useZipProcessing.ts    # Carga + extracción con progreso
│   ├── usePdfGeneration.ts    # Generación de PDF con liberación de buffers
│   └── usePdfSplit.ts         # Selección de páginas + división + descarga
├── components/                # Solo UI, sin lógica de negocio
│   ├── FileUploader.tsx       # Drag & drop de archivos ZIP
│   ├── FileList.tsx           # Lista con estados (cargando/éxito/error)
│   ├── ProcessingProgress.tsx # Barra de progreso
│   └── PdfViewer.tsx          # Vista previa con thumbnails + checkboxes
├── utils/                     # Utilidades compartidas
│   ├── imageDetection.ts      # Detección de extensiones de imagen
│   ├── memory.ts              # Liberación de buffers
│   └── pdfWorker.ts           # Configuración del worker de PDF.js
└── constants/                 # APP_NAME, MAX_FILE_SIZE_MB, etc.
```

## Control de memoria

Procesar ZIPs de hasta **400 MB** con cientos de imágenes requiere manejo cuidadoso de memoria:

- Los buffers de imagen se liberan inmediatamente después de ser embebidos en el PDF
- La barra de progreso se actualiza en tiempo real por cada imagen procesada
- JSZip mantiene un overhead de heap inferior al 1% del tamaño del ZIP
- La interfaz muestra advertencias para archivos mayores a 100 MB

## Desarrollo

```bash
# Instalar dependencias
npm install

# Iniciar servidor de desarrollo
npm run dev

# Compilar para producción
npm run build

# Previsualizar build de producción
npm run preview
```

## Despliegue en Vercel

La aplicación es completamente estática (sin backend). Para desplegar en Vercel:

1. Conectá el repositorio a Vercel
2. Vercel detecta Vite automáticamente
3. El comando de build es `npm run build`
4. El directorio de salida es `dist`

---

**Solutions & Payroll** — Conversor de Reembolsos ADP
