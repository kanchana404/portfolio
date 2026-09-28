/**
 * One image from Ideogram, or null. Server-only (it reads IDEOGRAM_API_KEY).
 *
 * Callers used to reach this through an HTTP call to /api/admin/generate-image
 * from inside another route. That never worked in production: the base URL
 * expression always fell through to https://undefined, the self-call carried
 * no admin cookie so it would have been refused anyway, and every failure was
 * papered over with a via.placeholder.com URL that no longer resolves. A post
 * then shipped a broken cover and a broken social card.
 *
 * Null means "no image": the blog falls back to its generated /og card.
 */
export async function generateImage(
  prompt: string,
  aspectRatio: string = "1x1"
): Promise<string | null> {
  const apiKey = process.env.IDEOGRAM_API_KEY;
  if (!apiKey || !prompt) return null;

  const formData = new FormData();
  formData.append("prompt", prompt);
  formData.append("aspect_ratio", aspectRatio);
  formData.append("rendering_speed", "DEFAULT");
  formData.append("magic_prompt", "ON");

  try {
    const response = await fetch("https://api.ideogram.ai/v1/ideogram-v3/generate", {
      method: "POST",
      headers: { "Api-Key": apiKey },
      body: formData,
      // API routes are capped at 15 s (vercel.json); leave room to save.
      signal: AbortSignal.timeout(11_000),
    });
    if (!response.ok) {
      console.error("Ideogram API error:", response.status, await response.text());
      return null;
    }
    const data = await response.json();
    const url: unknown =
      data.data?.[0]?.url ?? data.data?.[0]?.image_url ?? data.image_url ?? data.url;
    return typeof url === "string" && url.startsWith("https://") ? url : null;
  } catch (error) {
    console.error("Ideogram request failed:", error);
    return null;
  }
}

/**
 * True for a stored image URL that is known to be dead: the old fallback
 * wrote via.placeholder.com URLs into posts, and that host no longer answers.
 */
export function isDeadImageUrl(url: string | undefined | null): boolean {
  return !url || url.includes("via.placeholder.com");
}
