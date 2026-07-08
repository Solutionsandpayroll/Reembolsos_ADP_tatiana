/**
 * Spike: Generador de ZIPs de prueba
 *
 * Genera archivos ZIP con estructuras realistas que simulan los dos casos
 * descritos en los requisitos:
 *   Caso 1: ZIP principal > ZIPs internos > carpetas > carpetas > imagen
 *   Caso 2: ZIP principal > carpetas > imagen
 *
 * Los ZIPs generados contienen imágenes falsas (buffers binarios) que
 * simulan el peso de fotos reales (~2-5 MB cada una).
 *
 * Uso: node spike/generate-test-zip.js [--size 200] [--images 50] [--case both]
 */

import JSZip from "jszip";
import { randomBytes } from "crypto";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ─── Configuración ──────────────────────────────────────────────────────────

const config = {
  /** Tamaño total aproximado del ZIP final en MB */
  targetSizeMB: 200,
  /** Número total de imágenes a generar (se distribuyen entre los ZIPs) */
  totalImages: 80,
  /** Tamaño de cada imagen falsa en MB */
  imageSizeMB: 2.5,
  /** Casos a generar: 'case1' | 'case2' | 'both' */
  caseType: "both",
  /** Directorio de salida */
  outputDir: join(__dirname, "test-data"),
};

// Procesar argumentos CLI
for (let i = 2; i < process.argv.length; i++) {
  if (process.argv[i] === "--size" && process.argv[i + 1]) {
    config.targetSizeMB = parseInt(process.argv[i + 1]);
  }
  if (process.argv[i] === "--images" && process.argv[i + 1]) {
    config.totalImages = parseInt(process.argv[i + 1]);
  }
  if (process.argv[i] === "--image-size" && process.argv[i + 1]) {
    config.imageSizeMB = parseFloat(process.argv[i + 1]);
  }
  if (process.argv[i] === "--case" && process.argv[i + 1]) {
    config.caseType = process.argv[i + 1];
  }
}

// ─── Utilidades ─────────────────────────────────────────────────────────────

function mbToBytes(mb) {
  return Math.floor(mb * 1024 * 1024);
}

function bytesToMB(bytes) {
  return (bytes / (1024 * 1024)).toFixed(2);
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function generateFakeImage(index) {
  // Genera un buffer de bytes aleatorios simulando una imagen
  // JPEG minimo header + datos aleatorios = no comprime bien en ZIP (como imagenes reales)
  const size = mbToBytes(config.imageSizeMB);
  const header = Buffer.alloc(64);
  header.write("FAKE_IMAGE_DATA_", 0, "utf8");
  header.writeUInt32BE(index, 16);
  
  const data = randomBytes(size - 64);
  return Buffer.concat([header, data]);
}

async function buildZIP(entries) {
  const zip = new JSZip();
  for (const [path, data] of entries) {
    if (path.endsWith("/")) {
      zip.folder(path.slice(0, -1));
    } else {
      zip.file(path, data);
    }
  }
  return zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 1 }, // Baja compresión = más realista (imágenes ya están comprimidas)
  });
}

// ─── Caso 1: ZIP principal > ZIPs internos > carpetas > carpetas > imagen ──

async function generateCase1() {
  console.log("\n═══════════════════════════════════════════════════════════");
  console.log("  GENERANDO CASO 1: ZIP anidados con carpetas profundas");
  console.log("═══════════════════════════════════════════════════════════\n");

  const numInnerZips = 8;
  const imagesPerInnerZip = Math.ceil(config.totalImages / 2 / numInnerZips);

  console.log(`  ZIPs internos: ${numInnerZips}`);
  console.log(`  Imágenes por ZIP interno: ${imagesPerInnerZip}`);
  console.log(`  Tamaño por imagen: ${config.imageSizeMB} MB`);
  console.log(
    `  Tamaño estimado: ${(numInnerZips * imagesPerInnerZip * config.imageSizeMB).toFixed(0)} MB\n`
  );

  let imageCounter = 0;

  // Generar ZIPs internos
  const innerZipPaths = [];
  for (let i = 0; i < numInnerZips; i++) {
    console.log(`  Generando ZIP interno ${i + 1}/${numInnerZips}...`);
    const innerEntries = [];

    // Estructura: Persona_N/Factura_M/imagen.jpg
    for (let j = 0; j < imagesPerInnerZip; j++) {
      const person = `Persona_${String(i + 1).padStart(3, "0")}`;
      const folder = `Factura_${String(j + 1).padStart(2, "0")}`;
      const imgName = `imagen_${String(imageCounter + 1).padStart(4, "0")}.jpg`;

      const path = `${person}/${folder}/${imgName}`;
      const imageData = generateFakeImage(imageCounter);
      innerEntries.push([path, imageData]);
      imageCounter++;
    }

    const innerZipBuffer = await buildZIP(innerEntries);
    const innerZipName = `Soportes_Persona_${String(i + 1).padStart(3, "0")}.zip`;
    innerZipPaths.push([innerZipName, innerZipBuffer]);
  }

  // Generar ZIP principal
  console.log("\n  Generando ZIP principal (Caso 1)...");
  const mainZipBuffer = await buildZIP(innerZipPaths);
  const outputPath = join(config.outputDir, "test-case1-nested-zips.zip");

  mkdirSync(config.outputDir, { recursive: true });
  writeFileSync(outputPath, mainZipBuffer);

  console.log(`\n  ✓ Caso 1 generado: ${outputPath}`);
  console.log(`  Tamaño real: ${formatBytes(mainZipBuffer.length)}`);
  return { path: outputPath, size: mainZipBuffer.length, imageCount: imageCounter };
}

// ─── Caso 2: ZIP principal > carpetas > imagen ──────────────────────────────

async function generateCase2() {
  console.log("\n═══════════════════════════════════════════════════════════");
  console.log("  GENERANDO CASO 2: ZIP plano con carpetas e imágenes");
  console.log("═══════════════════════════════════════════════════════════\n");

  const numFolders = 20;
  const imagesPerFolder = Math.ceil(config.totalImages / 2 / numFolders);

  console.log(`  Carpetas: ${numFolders}`);
  console.log(`  Imágenes por carpeta: ${imagesPerFolder}`);
  console.log(`  Tamaño por imagen: ${config.imageSizeMB} MB`);
  console.log(
    `  Tamaño estimado: ${(numFolders * imagesPerFolder * config.imageSizeMB).toFixed(0)} MB\n`
  );

  let imageCounter = 0;
  const entries = [];

  for (let i = 0; i < numFolders; i++) {
    console.log(`  Generando carpeta ${i + 1}/${numFolders}...`);
    for (let j = 0; j < imagesPerFolder; j++) {
      const folder = `Persona_${String(i + 1).padStart(3, "0")}`;
      const imgName = `foto_${String(imageCounter + 1).padStart(4, "0")}.jpg`;
      const path = `${folder}/${imgName}`;
      const imageData = generateFakeImage(imageCounter);
      entries.push([path, imageData]);
      imageCounter++;
    }
  }

  const mainZipBuffer = await buildZIP(entries);
  const outputPath = join(config.outputDir, "test-case2-flat-folders.zip");

  mkdirSync(config.outputDir, { recursive: true });
  writeFileSync(outputPath, mainZipBuffer);

  console.log(`\n  ✓ Caso 2 generado: ${outputPath}`);
  console.log(`  Tamaño real: ${formatBytes(mainZipBuffer.length)}`);
  return { path: outputPath, size: mainZipBuffer.length, imageCount: imageCounter };
}

// ─── ZIP masivo (máximo estrés) ─────────────────────────────────────────────

async function generateMassive() {
  console.log("\n═══════════════════════════════════════════════════════════");
  console.log("  GENERANDO ZIP MASIVO (estrés máximo)");
  console.log("═══════════════════════════════════════════════════════════\n");

  const numImages = config.totalImages;
  console.log(`  Imágenes totales: ${numImages}`);
  console.log(`  Tamaño por imagen: ${config.imageSizeMB} MB`);
  console.log(`  Tamaño estimado: ${(numImages * config.imageSizeMB).toFixed(0)} MB\n`);

  const entries = [];

  for (let i = 0; i < numImages; i++) {
    if (i % 10 === 0) {
      console.log(`  Generando imagen ${i + 1}/${numImages}...`);
    }
    const folder = `Carpeta_${String(Math.floor(i / 5) + 1).padStart(4, "0")}`;
    const imgName = `imagen_${String(i + 1).padStart(5, "0")}.jpg`;
    entries.push([`${folder}/${imgName}`, generateFakeImage(i)]);
  }

  const zipBuffer = await buildZIP(entries);
  const outputPath = join(config.outputDir, "test-massive-single-zip.zip");

  mkdirSync(config.outputDir, { recursive: true });
  writeFileSync(outputPath, zipBuffer);

  console.log(`\n  ✓ ZIP masivo generado: ${outputPath}`);
  console.log(`  Tamaño real: ${formatBytes(zipBuffer.length)}`);
  return { path: outputPath, size: zipBuffer.length, imageCount: numImages };
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log("╔═══════════════════════════════════════════════════════════╗");
  console.log("║   SPIKE: Generador de ZIPs de prueba para JSZip          ║");
  console.log("╚═══════════════════════════════════════════════════════════╝");
  console.log(`\n  Target size: ${config.targetSizeMB} MB`);
  console.log(`  Imágenes totales: ${config.totalImages}`);
  console.log(`  Tamaño por imagen: ${config.imageSizeMB} MB`);
  console.log(`  Caso: ${config.caseType}`);

  const startTime = Date.now();
  const results = [];

  if (config.caseType === "case1" || config.caseType === "both") {
    results.push(await generateCase1());
  }

  if (config.caseType === "case2" || config.caseType === "both") {
    results.push(await generateCase2());
  }

  if (config.caseType === "massive") {
    results.push(await generateMassive());
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n═══════════════════════════════════════════════════════════`);
  console.log(`  RESUMEN`);
  console.log(`═══════════════════════════════════════════════════════════`);
  let totalSize = 0;
  let totalImages = 0;
  for (const r of results) {
    console.log(`  ${r.path}`);
    console.log(`    Tamaño: ${formatBytes(r.size)}  |  Imágenes: ${r.imageCount}`);
    totalSize += r.size;
    totalImages += r.imageCount;
  }
  console.log(`  ─────────────────────────────────────────────────────────`);
  console.log(`  Total: ${formatBytes(totalSize)}  |  ${totalImages} imágenes`);
  console.log(`  Tiempo de generación: ${elapsed}s`);
  console.log(`\n  ✓ Archivos guardados en: ${config.outputDir}`);
}

main().catch(console.error);
