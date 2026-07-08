/**
 * Spike: Prueba de rendimiento de JSZip con ZIPs anidados
 *
 * Responde: ¿Qué rendimiento tiene JSZip al procesar un ZIP real de
 * aproximadamente 400 MB con ZIP anidados y cientos de imágenes?
 *
 * Métricas:
 *   - Tiempo de carga (loadAsync)
 *   - Memoria usada al cargar
 *   - Tiempo de extracción recursiva de imágenes
 *   - Memoria al extraer
 *   - Rendimiento secuencial vs paralelo
 *
 * Uso: node spike/run-spike.js [path/to/test.zip]
 *      Si no se pasa archivo, busca en spike/test-data/
 */

import JSZip from "jszip";
import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ─── Utilidades ─────────────────────────────────────────────────────────────

function formatBytes(bytes) {
  if (!bytes || bytes < 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function formatDuration(ms) {
  if (ms < 1000) return `${ms.toFixed(0)} ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(2)} s`;
  const mins = Math.floor(ms / 60000);
  const secs = ((ms % 60000) / 1000).toFixed(1);
  return `${mins}m ${secs}s`;
}

function getMemory() {
  const mem = process.memoryUsage();
  return {
    heapUsed: mem.heapUsed,
    heapTotal: mem.heapTotal,
    rss: mem.rss,
    external: mem.external,
  };
}

function memDelta(before, after) {
  return {
    heapUsed: after.heapUsed - before.heapUsed,
    heapTotal: after.heapTotal - before.heapTotal,
    rss: after.rss - before.rss,
    external: after.external - before.external,
  };
}

function printMemory(label, mem) {
  console.log(
    `    ${label}: heap=${formatBytes(mem.heapUsed)} / rss=${formatBytes(mem.rss)}`
  );
}

function printMemoryDelta(label, delta) {
  const sign = delta.heapUsed >= 0 ? "+" : "";
  console.log(
    `    ${label}: heapΔ=${sign}${formatBytes(delta.heapUsed)}  rssΔ=${sign}${formatBytes(delta.rss)}`
  );
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Detección de imágenes ──────────────────────────────────────────────────

const IMAGE_EXTENSIONS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".bmp",
  ".webp",
  ".tiff",
  ".tif",
  ".svg",
]);

function isImage(filename) {
  const ext = filename.toLowerCase().slice(filename.lastIndexOf("."));
  return IMAGE_EXTENSIONS.has(ext);
}

// ─── Análisis de estructura del ZIP ─────────────────────────────────────────

function analyzeStructure(zip) {
  const files = [];
  const folders = new Set();
  const nestedZips = [];
  const images = [];

  zip.forEach((relativePath, zipEntry) => {
    if (zipEntry.dir) {
      folders.add(relativePath);
    } else {
      files.push(relativePath);

      if (relativePath.toLowerCase().endsWith(".zip")) {
        nestedZips.push(relativePath);
      } else if (isImage(relativePath)) {
        images.push(relativePath);
      }
    }
  });

  return { files, folders, nestedZips, images };
}

// ─── Extracción recursiva de imágenes (Caso 1 + Caso 2) ─────────────────────

/**
 * Recorre recursivamente un ZIP y todos los ZIP anidados.
 * Retorna todas las imágenes encontradas como { path, buffer }.
 */
async function extractImagesRecursive(zip, depth = 0, stats) {
  const pad = "  ".repeat(depth);
  const images = [];

  const structure = analyzeStructure(zip);
  stats.totalFiles += structure.files.length;
  stats.totalFolders += structure.folders.size;
  stats.totalNestedZips += structure.nestedZips.length;
  stats.maxDepth = Math.max(stats.maxDepth, depth);

  console.log(
    `${pad}[Nivel ${depth}] ${structure.files.length} archivos, ${structure.folders.size} carpetas, ${structure.nestedZips.length} ZIPs anidados, ${structure.images.length} imágenes directas`
  );

  // Extraer imágenes en este nivel
  for (const imgPath of structure.images) {
    const entry = zip.file(imgPath);
    if (entry) {
      const extStart = Date.now();
      const data = await entry.async("nodebuffer");
      stats.extractionTimeMs += Date.now() - extStart;
      images.push({ path: imgPath, buffer: data, depth });
      stats.totalImages++;
    }
  }

  // Recursivamente abrir ZIPs anidados
  for (const zipPath of structure.nestedZips) {
    console.log(`${pad}  Abriendo ZIP anidado: ${zipPath}`);
    const entry = zip.file(zipPath);
    if (entry) {
      const nestedBuffer = await entry.async("nodebuffer");
      const nestedZip = await JSZip.loadAsync(nestedBuffer);
      const nestedImages = await extractImagesRecursive(
        nestedZip,
        depth + 1,
        stats
      );
      images.push(...nestedImages);

      // Liberar referencia
      nestedBuffer.fill(0);
    }
  }

  return images;
}

// ─── Test principal ─────────────────────────────────────────────────────────

async function testZip(zipPath) {
  console.log("\n" + "═".repeat(65));
  console.log(`  SPIKE: Prueba de rendimiento de JSZip`);
  console.log("═".repeat(65));
  console.log(`  Archivo: ${zipPath}`);

  // Leer archivo del disco (esto simula el FileReader en el navegador)
  const memBeforeRead = getMemory();
  const readStart = Date.now();
  const rawBuffer = readFileSync(zipPath);
  const readTime = Date.now() - readStart;
  const memAfterRead = getMemory();

  console.log(`\n  ── LECTURA DEL ARCHIVO ──`);
  console.log(`  Tamaño físico: ${formatBytes(rawBuffer.length)}`);
  console.log(`  Tiempo de lectura: ${formatDuration(readTime)}`);
  printMemory("Memoria antes de leer", memBeforeRead);
  printMemory("Memoria después de leer", memAfterRead);
  printMemoryDelta("Delta lectura", memDelta(memBeforeRead, memAfterRead));

  // Forzar GC si es posible
  if (global.gc) {
    global.gc();
    console.log("  (GC forzado)");
  }

  // ─── TEST 1: Carga del ZIP ────────────────────────────────────────────

  console.log(`\n  ── TEST 1: Carga del ZIP (JSZip.loadAsync) ──`);
  const memBeforeLoad = getMemory();

  const loadStart = Date.now();
  const zip = await JSZip.loadAsync(rawBuffer, {
    // optimizeBinaryString: true, // ya no es necesario en versiones modernas
  });
  const loadTime = Date.now() - loadStart;

  const memAfterLoad = getMemory();
  const structure = analyzeStructure(zip);

  console.log(`  Tiempo de carga: ${formatDuration(loadTime)}`);
  console.log(`  Archivos encontrados: ${structure.files.length}`);
  console.log(`  Carpetas: ${structure.folders.size}`);
  console.log(`  ZIPs anidados: ${structure.nestedZips.length}`);
  console.log(`  Imágenes directas: ${structure.images.length}`);
  printMemory("Memoria antes de loadAsync", memBeforeLoad);
  printMemory("Memoria después de loadAsync", memAfterLoad);
  printMemoryDelta("Delta carga", memDelta(memBeforeLoad, memAfterLoad));

  // ─── TEST 2: Extracción secuencial ────────────────────────────────────

  console.log(`\n  ── TEST 2: Extracción recursiva de imágenes ──`);
  const memBeforeExtract = getMemory();
  const stats = {
    totalFiles: 0,
    totalFolders: 0,
    totalNestedZips: 0,
    totalImages: 0,
    maxDepth: 0,
    extractionTimeMs: 0,
  };

  const extractStart = Date.now();
  const allImages = await extractImagesRecursive(zip, 0, stats);
  const extractTime = Date.now() - extractStart;
  const memAfterExtract = getMemory();

  const totalImageBytes = allImages.reduce(
    (sum, img) => sum + img.buffer.length,
    0
  );

  console.log(`\n  ── RESULTADOS DE EXTRACCIÓN ──`);
  console.log(`  Tiempo total de extracción: ${formatDuration(extractTime)}`);
  console.log(`  Imágenes encontradas: ${allImages.length}`);
  console.log(
    `  Peso total de imágenes: ${formatBytes(totalImageBytes)}`
  );
  console.log(`  Profundidad máxima: ${stats.maxDepth}`);
  console.log(`  Tiempo de extracción pura (sin load): ${formatDuration(stats.extractionTimeMs)}`);
  printMemory("Memoria antes de extraer", memBeforeExtract);
  printMemory("Memoria después de extraer", memAfterExtract);
  printMemoryDelta(
    "Delta extracción",
    memDelta(memBeforeExtract, memAfterExtract)
  );

  // ─── TEST 3: Extracción secuencial (sin almacenar buffers) ────────────

  console.log(`\n  ── TEST 3: Extracción secuencial (sin almacenar buffers) ──`);
  const memBeforeSeq = getMemory();

  let count = 0;
  let totalBytes = 0;
  const seqStart = Date.now();

  // Simula procesamiento secuencial: extrae, procesa, libera
  async function sequentialExtract(z, d = 0) {
    const s = analyzeStructure(z);

    for (const imgPath of s.images) {
      const entry = z.file(imgPath);
      if (entry) {
        const data = await entry.async("nodebuffer");
        totalBytes += data.length;
        count++;
        // En producción aquí iría el procesamiento (ej: agregar a PDF)
        // Liberamos el buffer inmediatamente
        data.fill(0);
      }
    }

    for (const zipPath of s.nestedZips) {
      const entry = z.file(zipPath);
      if (entry) {
        const nestedBuffer = await entry.async("nodebuffer");
        const nestedZip = await JSZip.loadAsync(nestedBuffer);
        await sequentialExtract(nestedZip, d + 1);
        nestedBuffer.fill(0);
      }
    }
  }

  await sequentialExtract(zip);
  const seqTime = Date.now() - seqStart;
  const memAfterSeq = getMemory();

  console.log(`  Imágenes procesadas: ${count}`);
  console.log(`  Total bytes procesados: ${formatBytes(totalBytes)}`);
  console.log(`  Tiempo: ${formatDuration(seqTime)}`);
  console.log(
    `  Throughput: ${formatBytes(totalBytes / (seqTime / 1000))}/s`
  );
  printMemory("Memoria antes", memBeforeSeq);
  printMemory("Memoria después", memAfterSeq);
  printMemoryDelta("Delta secuencial", memDelta(memBeforeSeq, memAfterSeq));

  // ─── Resumen comparativo ──────────────────────────────────────────────

  console.log("\n" + "═".repeat(65));
  console.log("  RESUMEN FINAL DEL SPIKE");
  console.log("═".repeat(65));

  const tableData = [
    ["Lectura de disco", formatDuration(readTime), formatBytes(rawBuffer.length)],
    ["Carga JSZip (loadAsync)", formatDuration(loadTime), "—"],
    [
      "Extracción recursiva (buffers)",
      formatDuration(extractTime),
      formatBytes(totalImageBytes),
    ],
    [
      "Extracción secuencial (no buffers)",
      formatDuration(seqTime),
      formatBytes(totalBytes),
    ],
  ];

  console.log("");
  console.log(
    "  | Fase                    | Tiempo       | Datos procesados  |"
  );
  console.log(
    "  |─────────────────────────|──────────────|───────────────────|"
  );
  for (const [phase, time, data] of tableData) {
    console.log(
      `  | ${phase.padEnd(23)} | ${time.padEnd(12)} | ${data.padEnd(17)} |`
    );
  }
  console.log("");

  const totalTime = readTime + loadTime + seqTime;
  console.log(`  Tiempo total (lectura + carga + extracción secuencial): ${formatDuration(totalTime)}`);

  // ─── Diagnóstico para 400 MB ─────────────────────────────────────────

  console.log("\n" + "═".repeat(65));
  console.log("  DIAGNÓSTICO: Proyección para 400 MB");
  console.log("═".repeat(65));

  const ratio = 400 / (rawBuffer.length / (1024 * 1024));
  const projectedLoadTime = loadTime * ratio;
  const projectedSeqTime = seqTime * ratio;
  const projectedMemDelta = memDelta(memBeforeLoad, memAfterLoad).heapUsed * ratio;

  console.log(`\n  Factor de escala (400MB / ${(rawBuffer.length / (1024 * 1024)).toFixed(0)}MB): x${ratio.toFixed(1)}`);
  console.log(`  Tiempo de carga estimado: ${formatDuration(projectedLoadTime)}`);
  console.log(`  Tiempo de extracción estimado: ${formatDuration(projectedSeqTime)}`);
  console.log(`  Memoria adicional estimada: ${formatBytes(projectedMemDelta)}`);

  // ─── Conclusiones ────────────────────────────────────────────────────

  console.log("\n" + "═".repeat(65));
  console.log("  CONCLUSIONES DEL SPIKE");
  console.log("═".repeat(65));

  const memIncreaseLoad = memDelta(memBeforeLoad, memAfterLoad).heapUsed;
  const memRatio = memIncreaseLoad / rawBuffer.length;

  console.log(`\n  1. Overhead de memoria de JSZip:`);
  console.log(
    `     Por cada byte de ZIP, JSZip consume ~${(memRatio * 100).toFixed(1)}% adicional en heap`
  );
  console.log(
    `     Para 400 MB, eso significa ~${formatBytes(400 * 1024 * 1024 * memRatio)} adicionales`
  );

  console.log(`\n  2. Rendimiento de carga:`);
  console.log(
    `     JSZip procesa ~${formatBytes(rawBuffer.length / (loadTime / 1000))}/s durante loadAsync`
  );

  console.log(`\n  3. Extracción secuencial:`);
  console.log(
    `     Procesando y liberando, throughput de ~${formatBytes(totalBytes / (seqTime / 1000))}/s`
  );

  console.log(`\n  4. Viabilidad en navegador:`);
  const estimatedTotalMem =
    rawBuffer.length + memAfterLoad.heapUsed * ratio * 1.5; // 1.5x safety factor
  console.log(
    `     Memoria total estimada para 400 MB: ${formatBytes(estimatedTotalMem)}`
  );

  if (estimatedTotalMem > 1024 * 1024 * 1024) {
    console.log(`     ⚠  ADVERTENCIA: Podría exceder 1 GB de RAM del navegador`);
    console.log(
      `     ⚠  Recomendación: Procesar en streaming o dividir en chunks`
    );
  }
  if (estimatedTotalMem > 2 * 1024 * 1024 * 1024) {
    console.log(
      `     🚫  PELIGRO: Riesgo alto de crash en navegadores de 32-bit`
    );
    console.log(
      `     🚫  Se requiere rediseñar la arquitectura para manejo por streaming`
    );
  }
  if (estimatedTotalMem <= 1024 * 1024 * 1024) {
    console.log(`     ✓  Debería funcionar en navegadores modernos (64-bit)`);
    console.log(`     ✓  Recomendación: Usar extracción secuencial con GC frecuente`);
  }

  console.log(`\n  5. Recomendaciones:`);
  console.log(`     - Usar extracción secuencial, liberar buffers inmediatamente`);
  console.log(`     - NO almacenar todas las imágenes en memoria simultáneamente`);
  console.log(`     - Construir el PDF incrementalmente (pdf-lib lo permite)`);
  console.log(`     - Mostrar barra de progreso basada en imágenes procesadas`);
  console.log(`     - Considerar Web Workers para no bloquear la UI`);
  console.log("");
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  // Buscar ZIP de prueba
  let targetZip = process.argv[2];

  if (!targetZip) {
    const testDir = join(__dirname, "test-data");
    const candidates = [
      join(testDir, "test-case1-nested-zips.zip"),
      join(testDir, "test-case2-flat-folders.zip"),
      join(testDir, "test-massive-single-zip.zip"),
    ];

    for (const c of candidates) {
      if (existsSync(c)) {
        targetZip = c;
        console.log(`Auto-detectado: ${targetZip}`);
        break;
      }
    }

    if (!targetZip) {
      console.error(
        "❌ No se encontraron ZIPs de prueba. Ejecuta primero:"
      );
      console.error(
        "   node spike/generate-test-zip.js --size 200 --images 80"
      );
      process.exit(1);
    }
  }

  // Forzar GC si se ejecuta con --expose-gc
  console.log("GC expuesto:", typeof global.gc === "function");

  try {
    await testZip(targetZip);
    console.log("✅ Spike completado exitosamente.\n");
  } catch (err) {
    console.error("❌ Error durante el spike:", err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

main();
