/** Shared media helpers that are safe to import from both server and client components. */
export function isVideo(url: unknown): boolean {
  return typeof url === "string" && /\.(mp4|webm|mov)(\?|$)/i.test(url);
}
