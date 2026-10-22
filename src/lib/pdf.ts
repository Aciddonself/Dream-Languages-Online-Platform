import { readFile } from "node:fs/promises";
import path from "node:path";

function pdfText(value: string) {
  return value
    .replace(/[^\x20-\x7e]/g, "?")
    .replaceAll("\\", "\\\\")
    .replaceAll("(", "\\(")
    .replaceAll(")", "\\)");
}

function getJpegInfo(jpeg: Uint8Array) {
  if (jpeg[0] !== 0xff || jpeg[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 4 < jpeg.length) {
    if (jpeg[offset] !== 0xff) {
      offset++;
      continue;
    }
    const marker = jpeg[offset + 1];
    offset += 2;
    if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (offset + 2 > jpeg.length) return null;
    const segmentLength = (jpeg[offset] << 8) + jpeg[offset + 1];
    if (segmentLength < 2 || offset + segmentLength > jpeg.length) return null;
    if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
      if (segmentLength < 8) return null;
      const height = (jpeg[offset + 3] << 8) + jpeg[offset + 4];
      const width = (jpeg[offset + 5] << 8) + jpeg[offset + 6];
      const components = jpeg[offset + 7];
      if (width > 0 && height > 0 && [1, 3].includes(components)) return { width, height, colorSpace: components === 1 ? "DeviceGray" : "DeviceRGB" };
      return null;
    }
    if (marker === 0xda) return null;
    offset += segmentLength;
  }
  return null;
}

export async function readProfilePhotoJpeg(storageKey: string | null | undefined) {
  if (!storageKey) return undefined;
  if (!/^[a-f0-9-]{36}\.(jpg|png|webp)$/i.test(storageKey)) {
    throw new Error("The stored profile photo key is invalid.");
  }
  if (!storageKey.toLowerCase().endsWith(".jpg")) return undefined;
  const jpeg = new Uint8Array(await readFile(path.join(process.cwd(), "private_uploads", storageKey)));
  if (!getJpegInfo(jpeg)) throw new Error("The stored profile photo is not a supported JPEG image.");
  return jpeg;
}

export function isProfilePhotoJpeg(jpeg: Uint8Array) {
  return getJpegInfo(jpeg) !== null;
}

export function createTextPdf(title: string, lines: string[], portraitJpeg?: Uint8Array) {
  const maxLineLength = portraitJpeg ? 64 : 88;
  const wrappedLines = lines.flatMap((line) => {
    const words = line.split(/\s+/);
    const wrapped: string[] = [];
    let current = "";
    for (const word of words) {
      const next = current ? `${current} ${word}` : word;
      if (next.length > maxLineLength && current) {
        wrapped.push(current);
        current = word;
      } else {
        current = next;
      }
    }
    wrapped.push(current);
    return wrapped;
  });
  const pages = [];
  const pageLines = [title, ...wrappedLines].reduce<string[][]>((all, line, index) => {
    const page = Math.floor(index / 44);
    all[page] ??= [];
    all[page].push(line);
    return all;
  }, []);

  const portraitInfo = portraitJpeg ? getJpegInfo(portraitJpeg) : null;
  const includePortrait = Boolean(portraitInfo && portraitJpeg);
  const portraitObjectId = includePortrait ? 4 + pageLines.length * 2 : null;

  for (const [pageIndex, contentLines] of pageLines.entries()) {
    const photo = includePortrait && pageIndex === 0 ? "q 60 0 0 72 490 720 cm /Portrait Do Q\n" : "";
    const stream = [
      photo,
      "BT",
      "/F1 18 Tf",
      "48 790 Td",
      `(${pdfText(contentLines[0] ?? title)}) Tj`,
      "/F1 11 Tf",
      ...contentLines.slice(1).flatMap((line) => ["0 -16 Td", `(${pdfText(line)}) Tj`]),
      "ET",
    ].join("\n");
    pages.push(stream);
  }

  const objects: (string | Buffer)[] = [];
  const pageObjectIds = pages.map((_, index) => 4 + index * 2);
  objects.push("<< /Type /Catalog /Pages 2 0 R >>");
  objects.push(`<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pages.length} >>`);
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");

  pages.forEach((stream, index) => {
    const pageId = pageObjectIds[index];
    const contentId = pageId + 1;
    const width = Buffer.byteLength(stream, "ascii");
    const imageResource = portraitObjectId ? `/XObject << /Portrait ${portraitObjectId} 0 R >>` : "";
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> ${imageResource} >> /Contents ${contentId} 0 R >>`);
    objects.push(`<< /Length ${width} >>\nstream\n${stream}\nendstream`);
  });

  if (portraitInfo && portraitJpeg) {
    const imageHeader = Buffer.from(
      `<< /Type /XObject /Subtype /Image /Width ${portraitInfo.width} /Height ${portraitInfo.height} /ColorSpace /${portraitInfo.colorSpace} /BitsPerComponent 8 /Filter /DCTDecode /Length ${portraitJpeg.byteLength} >>\nstream\n`,
      "ascii",
    );
    objects.push(Buffer.concat([imageHeader, Buffer.from(portraitJpeg), Buffer.from("\nendstream", "ascii")]));
  }

  const chunks: Buffer[] = [Buffer.from("%PDF-1.4\n", "ascii")];
  const offsets = [0];
  let offset = chunks[0].length;

  objects.forEach((body, index) => {
    offsets.push(offset);
    const chunk = Buffer.isBuffer(body)
      ? Buffer.concat([Buffer.from(`${index + 1} 0 obj\n`, "ascii"), body, Buffer.from("\nendobj\n", "ascii")])
      : Buffer.from(`${index + 1} 0 obj\n${body}\nendobj\n`, "ascii");
    chunks.push(chunk);
    offset += chunk.length;
  });

  const xrefOffset = offset;
  const xref = [
    `xref\n0 ${objects.length + 1}`,
    "0000000000 65535 f ",
    ...offsets.slice(1).map((value) => `${String(value).padStart(10, "0")} 00000 n `),
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>`,
    `startxref\n${xrefOffset}`,
    "%%EOF",
  ].join("\n");
  chunks.push(Buffer.from(`${xref}\n`, "ascii"));
  return new Uint8Array(Buffer.concat(chunks));
}
