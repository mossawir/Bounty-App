/** Never redirect to an off-site URL from a query parameter. */
export function safeNextPath(raw: string | null): string {
  if (!raw) return '/account';
  if (!raw.startsWith('/') || raw.startsWith('//')) return '/account';
  if (raw.startsWith('/login')) return '/account';
  return raw;
}
