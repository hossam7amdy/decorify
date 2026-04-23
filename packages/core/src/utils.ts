export function joinPath(prefix: string, path: string): string {
  const combined = `${prefix}/${path}`;
  const normalized = combined.replace(/\/+/g, "/").replace(/\/$/, "");
  return normalized.startsWith("/") ? normalized : "/" + normalized;
}
