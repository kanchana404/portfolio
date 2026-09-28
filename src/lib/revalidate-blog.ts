import { revalidatePath } from "next/cache";

/**
 * Refresh everything a blog write can change, now rather than within the hour
 * the ISR pages would otherwise wait: every post page (a new, retitled or
 * deleted post also changes its neighbours' Previous/Next cards, and an
 * unpublished or renamed post must stop being served at its old URL) and the
 * sitemap. /blog itself renders per request and needs nothing.
 */
export function revalidateBlog() {
  revalidatePath("/blog/[slug]", "page");
  revalidatePath("/sitemap.xml");
}
