/**
 * The server decoder, and the consent that has to come before it.
 *
 * Everything else in this tool is a promise that the file never leaves the
 * device, and the page says so in as many words. This is the one path that
 * breaks that promise, so it is never taken automatically — `decodeOnServer`
 * cannot be reached without the person having been told what will be sent and
 * having said yes to that specific file.
 *
 * That is a deliberate cost. Uploading silently would be easier, would work,
 * and nobody would notice — which is exactly why it is worth not doing. A page
 * that claims local-only processing and quietly posts your photographs is
 * lying, and the fact that the lie is convenient does not make it smaller.
 *
 * The service itself stores nothing: the upload is decoded from memory and the
 * PNG comes back in the response body, so there is no temporary file to leak or
 * to forget to delete. See `image-api/app/main.py`.
 */

import { ImageConvertError } from "./pipeline";

/**
 * Where the decoder lives. Absent in most deployments, and that is a supported
 * state rather than a misconfiguration — with no URL the tool is browser-only
 * and simply refuses HEIC and RAW, which is what it did before the service
 * existed.
 */
export const IMAGE_API = process.env.NEXT_PUBLIC_IMAGE_API ?? "";

export function serverDecodingAvailable(): boolean {
  return IMAGE_API.length > 0;
}

/**
 * Formats worth offering the server for.
 *
 * Only what a browser genuinely cannot read. Offering to upload a corrupt PNG
 * would be a round trip that ends in the same error, having sent the file for
 * nothing — so a failure is only escalated when the extension says it is one of
 * these.
 */
const SERVER_DECODABLE = new Set([
  "heic", "heif", "hif",
  "cr2", "cr3", "crw", "nef", "nrw", "arw", "srf", "sr2", "dng",
  "raf", "orf", "rw2", "raw", "pef", "srw", "x3f", "3fr", "mrw",
  "psd", "pdf",
]);

export function couldServerDecode(filename: string): boolean {
  if (!serverDecodingAvailable()) return false;
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  return SERVER_DECODABLE.has(ext);
}

/** A readable name for the family a file belongs to, for the consent prompt. */
export function serverFormatLabel(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "heic" || ext === "heif" || ext === "hif") return "HEIC";
  if (ext === "psd") return "Photoshop";
  if (ext === "pdf") return "PDF";
  return "camera RAW";
}

/**
 * Sends one file to be decoded, and returns the PNG that comes back.
 *
 * Only ever called after an explicit yes. The caller owns that consent; this
 * function's job is to make the request honest — no retries that would resend a
 * file the person may have changed their mind about, and an abort signal so
 * closing the widget actually stops the upload.
 */
export async function decodeOnServer(
  file: Blob,
  filename: string,
  signal?: AbortSignal
): Promise<Blob> {
  const body = new FormData();
  body.append("file", file, filename);

  let response: Response;
  try {
    response = await fetch(`${IMAGE_API}/v1/decode`, {
      method: "POST",
      body,
      signal,
      // No cookies, no credentials. The service authenticates nothing and
      // should never be handed a session.
      credentials: "omit",
      cache: "no-store",
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new ImageConvertError(
      "The converter could not be reached. Your file was not sent anywhere."
    );
  }

  if (!response.ok) {
    // The service returns a plain, already-sanitised message; prefer it to a
    // status code, and fall back only if the body is not what we expect.
    const message = await response
      .json()
      .then((body: { error?: string }) => body.error)
      .catch(() => null);
    throw new ImageConvertError(
      message ?? `The converter refused this file (${response.status}).`
    );
  }

  const blob = await response.blob();
  if (blob.type !== "image/png") {
    throw new ImageConvertError("The converter returned something unreadable.");
  }
  return blob;
}
