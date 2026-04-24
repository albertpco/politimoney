import { execFile } from "node:child_process";
import { createWriteStream } from "node:fs";
import { mkdir, stat, unlink } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { promisify } from "node:util";
import yauzl from "yauzl";

const FEC_BULK_BASE = "https://www.fec.gov/files/bulk-downloads";
const execFileAsync = promisify(execFile);

export type BulkFileSpec = {
  filename: string;
  isZip: boolean;
  delimiter: "|" | ",";
  hasHeaders: boolean;
  columns: readonly string[];
};

async function downloadWithCurl(url: string, localPath: string): Promise<void> {
  // curl handles timeouts, retries, and progress for large files
  await execFileAsync("curl", [
    "-L",           // follow redirects
    "-f",           // fail on HTTP errors
    "-o", localPath,
    "--retry", "3",
    "--retry-delay", "5",
    "--connect-timeout", "30",
    "--max-time", "7200",  // 2 hour max for huge files
    "-#",           // progress bar (goes to stderr)
    url,
  ], { maxBuffer: 10 * 1024 * 1024, timeout: 7200_000 });
}

async function downloadWithFetch(url: string, localPath: string): Promise<void> {
  const response = await fetch(url, { redirect: "follow" });
  if (!response.ok) {
    throw new Error(`Failed to download ${url}: ${response.status} ${response.statusText}`);
  }
  const body = response.body;
  if (!body) {
    throw new Error(`No response body for ${url}`);
  }
  const nodeStream = Readable.fromWeb(body as import("stream/web").ReadableStream);
  await pipeline(nodeStream, createWriteStream(localPath));
}

export async function downloadBulkFile(
  cycle: number,
  filename: string,
  cacheDir: string,
): Promise<string> {
  const cycleDir = path.join(cacheDir, String(cycle));
  await mkdir(cycleDir, { recursive: true });

  const localPath = path.join(cycleDir, filename);

  try {
    const existing = await stat(localPath);
    if (existing.size > 0) {
      console.log(`[bulk] using cached ${filename} (${(existing.size / 1024 / 1024).toFixed(1)}MB)`);
      return localPath;
    }
  } catch {
    // File doesn't exist, download it
  }

  const url = `${FEC_BULK_BASE}/${cycle}/${filename}`;
  console.log(`[bulk] downloading ${url}`);

  // Use curl for large files (more reliable for multi-GB downloads)
  const isLargeFile = filename.startsWith("indiv") || filename.startsWith("oth");
  if (isLargeFile) {
    console.log(`[bulk] using curl for large file ${filename}...`);
    await downloadWithCurl(url, localPath);
  } else {
    await downloadWithFetch(url, localPath);
  }

  const downloaded = await stat(localPath);
  console.log(`[bulk] downloaded ${filename} (${(downloaded.size / 1024 / 1024).toFixed(1)}MB)`);
  return localPath;
}

export function openZipEntryStream(zipPath: string): Promise<Readable> {
  return new Promise((resolve, reject) => {
    yauzl.open(zipPath, { lazyEntries: true }, (err, zipfile) => {
      if (err || !zipfile) {
        reject(err ?? new Error("Failed to open ZIP"));
        return;
      }

      zipfile.readEntry();
      zipfile.on("entry", (entry) => {
        // Read the first (usually only) entry in the ZIP
        zipfile.openReadStream(entry, (streamErr, readStream) => {
          if (streamErr || !readStream) {
            reject(streamErr ?? new Error("Failed to open ZIP entry stream"));
            return;
          }
          readStream.on("end", () => zipfile.close());
          resolve(readStream);
        });
      });

      zipfile.on("error", reject);
      zipfile.on("end", () => {
        // If no entries found
        reject(new Error(`No entries found in ZIP: ${zipPath}`));
      });
    });
  });
}

export async function cleanupCacheFile(filePath: string): Promise<void> {
  try {
    await unlink(filePath);
  } catch {
    // Ignore cleanup errors
  }
}
