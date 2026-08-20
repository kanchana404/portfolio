/**
 * Talking to the PDF service.
 *
 * Unlike the image decoder, these tools cannot fall back to the browser. There
 * is no PDF text extractor in a browser worth shipping, and rendering a page
 * needs poppler. The upload is not optional here, and the interface says so
 * plainly rather than presenting a tool that silently does nothing.
 *
 * That makes consent more important, not less. A PDF is far more likely to be a
 * contract, an invoice or a scan of an identity document than a holiday photo
 * is, so the widget asks before the first byte moves and says what happens to
 * the file. The service writes nothing to disk: the upload is parsed in memory
 * and the response is the only copy that leaves it.
 */

export const PDF_API = process.env.NEXT_PUBLIC_IMAGE_API ?? "";

export function pdfServiceAvailable(): boolean {
  return PDF_API.length > 0;
}

export class PdfServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PdfServiceError";
  }
}

async function send(path: string, file: File, signal?: AbortSignal): Promise<Response> {
  const body = new FormData();
  body.append("file", file, file.name);
  try {
    return await fetch(`${PDF_API}${path}`, {
      method: "POST",
      body,
      signal,
      credentials: "omit",
      cache: "no-store",
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new PdfServiceError(
      "The converter could not be reached. Your file was not sent anywhere."
    );
  }
}

async function refuse(response: Response): Promise<never> {
  // The service returns an already-sanitised message; prefer it to a bare code.
  const message = await response
    .json()
    .then((b: { error?: string }) => b.error)
    .catch(() => null);
  throw new PdfServiceError(
    message ?? `The converter refused this file (${response.status}).`
  );
}

export interface PdfText {
  pages: string[];
  pageCount: number;
  hasText: boolean;
  /** Set when there is no text layer, explaining why rather than returning "". */
  note: string | null;
}

export async function extractText(file: File, signal?: AbortSignal): Promise<PdfText> {
  const response = await send("/v1/pdf/text", file, signal);
  if (!response.ok) await refuse(response);
  return (await response.json()) as PdfText;
}

export async function pdfInfo(
  file: File,
  signal?: AbortSignal
): Promise<{ pageCount: number; maxPages: number }> {
  const response = await send("/v1/pdf/info", file, signal);
  if (!response.ok) await refuse(response);
  return (await response.json()) as { pageCount: number; maxPages: number };
}

export async function renderPage(
  file: File,
  page: number,
  signal?: AbortSignal
): Promise<Blob> {
  const response = await send(`/v1/pdf/render?page=${page}`, file, signal);
  if (!response.ok) await refuse(response);
  const blob = await response.blob();
  if (blob.type !== "image/png") {
    throw new PdfServiceError("The converter returned something unreadable.");
  }
  return blob;
}
