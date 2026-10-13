import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, writeFile, rm, readdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import exifr from "exifr";
import { ApiError, str, object } from "./core";
import type { IngestedArtifact } from "../src/types/osint";

const execute = promisify(execFile);
export function decodeBase64(value: unknown): Buffer {
  const encoded = str(value, "fileBase64", 14_000_000).replace(
    /^data:[\w.+/-]+;base64,/,
    "",
  );
  if (
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
      encoded,
    )
  )
    throw new ApiError(400, "Invalid base64 encoding");
  const buffer = Buffer.from(encoded, "base64");
  if (!buffer.length || buffer.length > 10 * 1024 * 1024)
    throw new ApiError(413, "File must be between 1 byte and 10 MiB");
  return buffer;
}
export function fileKind(buffer: Buffer): "pdf" | "image" | "text" {
  if (buffer.subarray(0, 5).toString() === "%PDF-") return "pdf";
  if (
    buffer.subarray(0, 3).equals(Buffer.from([255, 216, 255])) ||
    buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  )
    return "image";
  if (
    buffer.includes(0) ||
    Buffer.from(buffer.toString("utf8"), "utf8").compare(buffer) !== 0
  )
    throw new ApiError(
      415,
      "Supported files: UTF-8 text/code, PDF, JPEG and PNG",
    );
  return "text";
}
export async function command(binary: string, args: string[]) {
  try {
    return await execute(binary, args, {
      timeout: 30000,
      maxBuffer: 4 * 1024 * 1024,
      env: { ...process.env, OMP_THREAD_LIMIT: "1" },
    });
  } catch (err: any) {
    if (err.code === "ENOENT")
      throw new ApiError(503, `${binary} is not installed`);
    if (err.killed) throw new ApiError(504, "File processing timed out");
    throw new ApiError(422, `${binary} could not process this file`);
  }
}
export async function readExif(buffer: Buffer) {
  if (fileKind(buffer) !== "image")
    throw new ApiError(415, "EXIF requires JPEG or PNG");
  try {
    const tags = await exifr.parse(buffer);
    if (!tags || !Object.keys(tags).length) return { hasExif: false };
    const data: NonNullable<IngestedArtifact["exifParsed"]> &
      Record<string, any> = { hasExif: false };
    for (const [target, source] of Object.entries({
      cameraMake: "Make",
      cameraModel: "Model",
      lens: "LensModel",
      software: "Software",
      dateTimeOriginal: "DateTimeOriginal",
      latitude: "latitude",
      longitude: "longitude",
      altitudeMeters: "GPSAltitude",
    })) {
      const v = tags[source];
      if (v instanceof Date) data[target] = v.toISOString();
      else if (typeof v === "string") data[target] = v.slice(0, 500);
      else if (typeof v === "number" && Number.isFinite(v)) data[target] = v;
    }
    data.hasExif = Object.keys(data).length > 1;
    return data;
  } catch {
    throw new ApiError(422, "Invalid image metadata");
  }
}
export async function preprocess(buffer: Buffer, ocr = true) {
  const kind = fileKind(buffer);
  if (kind === "text")
    return {
      text: buffer.toString("utf8"),
      exif: undefined,
      warnings: [] as string[],
    };
  const dir = await mkdtemp(path.join(os.tmpdir(), "deeposint-"));
  try {
    const input = path.join(dir, kind === "pdf" ? "input.pdf" : "input.image");
    await writeFile(input, buffer, { mode: 0o600 });
    let text = "";
    const exif = kind === "image" ? await readExif(buffer) : undefined;
    if (kind === "pdf") {
      const result = await command("pdftotext", [
        "-layout",
        "-enc",
        "UTF-8",
        input,
        "-",
      ]);
      text = result.stdout;
      if (!text.trim() && ocr) {
        await command("pdftoppm", [
          "-f",
          "1",
          "-l",
          "10",
          "-scale-to",
          "2000",
          "-png",
          input,
          path.join(dir, "page"),
        ]);
        for (const file of (await readdir(dir))
          .filter((f) => f.endsWith(".png"))
          .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))) {
          text +=
            (
              await command("tesseract", [
                path.join(dir, file),
                "stdout",
                "--psm",
                "3",
              ])
            ).stdout + "\n";
        }
        return {
          text,
          exif,
          warnings: ["Scanned PDF OCR limited to first 10 pages."],
        };
      }
    } else if (ocr)
      text = (await command("tesseract", [input, "stdout", "--psm", "3"]))
        .stdout;
    return {
      text,
      exif,
      warnings: text.trim() ? [] : ["No text was extracted."],
    };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
export function fileInput(body: unknown) {
  const b = object(body);
  return decodeBase64(b.fileBase64 ?? b.imageBase64);
}
