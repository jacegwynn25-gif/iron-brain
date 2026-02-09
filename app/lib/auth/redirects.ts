export function getReturnToFromLocation(): string | null {
  if (typeof window === 'undefined') return null;
  return `${window.location.pathname}${window.location.search}`;
}

export function buildLoginUrl(returnTo?: string | null): string {
  if (!returnTo) return '/login';
  if (!returnTo.startsWith('/')) return '/login';
  if (returnTo.startsWith('//')) return '/login';
  return `/login?returnTo=${encodeURIComponent(returnTo)}`;
}
