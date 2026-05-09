const CANONICAL_PUBLIC_APP_URL = 'https://ironbrain.dev';

const LEGACY_PUBLIC_APP_URLS = new Set([
  'https://iron-brain.vercel.app',
]);

function normalizePublicUrl(value: string | undefined) {
  if (!value) return null;

  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    url.pathname = url.pathname.replace(/\/+$/, '');
    url.search = '';
    url.hash = '';
    return url.toString().replace(/\/+$/, '');
  } catch {
    return null;
  }
}

const configuredPublicUrl = normalizePublicUrl(process.env.NEXT_PUBLIC_APP_URL);

export const PUBLIC_APP_URL =
  configuredPublicUrl && !LEGACY_PUBLIC_APP_URLS.has(configuredPublicUrl)
    ? configuredPublicUrl
    : CANONICAL_PUBLIC_APP_URL;

export function publicAppUrl(path = '') {
  if (!path) return PUBLIC_APP_URL;
  return `${PUBLIC_APP_URL}${path.startsWith('/') ? path : `/${path}`}`;
}
