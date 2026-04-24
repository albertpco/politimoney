import { createReadStream } from "node:fs";
import { Readable } from "node:stream";
import Papa from "papaparse";

export type ParsedRow = Record<string, string>;

// High-water mark: pause input when buffer exceeds this to apply backpressure
const BUFFER_HIGH_WATER = 10_000;
const BUFFER_LOW_WATER = 1_000;

export async function* streamParseBulkFile(
  input: Readable,
  options: {
    delimiter: "|" | ",";
    columns: readonly string[];
    hasHeaders: boolean;
  },
): AsyncGenerator<ParsedRow> {
  const rows: ParsedRow[] = [];
  let resolveNext: (() => void) | null = null;
  let done = false;
  let parseError: Error | null = null;
  let paused = false;

  const stream = Papa.parse(Papa.NODE_STREAM_INPUT, {
    delimiter: options.delimiter,
    header: options.hasHeaders,
    skipEmptyLines: true,
    dynamicTyping: false,
  });

  stream.on("data", (row: Record<string, string> | string[]) => {
    let mapped: ParsedRow;
    if (Array.isArray(row)) {
      // Headerless mode: map positional columns
      mapped = {};
      for (let i = 0; i < options.columns.length && i < row.length; i++) {
        mapped[options.columns[i]] = row[i] ?? "";
      }
    } else {
      mapped = row;
    }
    rows.push(mapped);

    // Backpressure: pause input when buffer is full
    if (!paused && rows.length >= BUFFER_HIGH_WATER) {
      paused = true;
      input.pause();
    }

    if (resolveNext) {
      resolveNext();
      resolveNext = null;
    }
  });

  stream.on("end", () => {
    done = true;
    if (resolveNext) {
      resolveNext();
      resolveNext = null;
    }
  });

  stream.on("error", (err: Error) => {
    parseError = err;
    done = true;
    if (resolveNext) {
      resolveNext();
      resolveNext = null;
    }
  });

  input.pipe(stream);

  while (true) {
    if (rows.length > 0) {
      yield rows.shift()!;

      // Resume input when buffer drains below low-water mark
      if (paused && rows.length <= BUFFER_LOW_WATER) {
        paused = false;
        input.resume();
      }
      continue;
    }
    if (done) break;
    if (parseError) throw parseError;
    await new Promise<void>((resolve) => {
      resolveNext = resolve;
    });
  }

  // Drain any remaining rows
  while (rows.length > 0) {
    yield rows.shift()!;
  }

  if (parseError) throw parseError;
}

export function createFileStream(filePath: string): Readable {
  return createReadStream(filePath, { encoding: "utf-8" });
}
