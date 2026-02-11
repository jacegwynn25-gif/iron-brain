import { supabase } from '../supabase/client';

export async function fetchWithAuth(input: RequestInfo | URL, init?: RequestInit) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) {
    throw new Error('Missing auth session');
  }

  const headers = new Headers(init?.headers ?? {});
  headers.set('Authorization', `Bearer ${token}`);

  return fetch(input, {
    ...init,
    headers,
  });
}

export async function fetchJsonWithAuth<T>(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<T> {
  const response = await fetchWithAuth(input, init);
  const payload = (await response.json()) as T & { error?: string };
  if (!response.ok) {
    const errorMessage =
      typeof (payload as { error?: unknown }).error === 'string'
        ? (payload as { error: string }).error
        : `Request failed (${response.status})`;
    throw new Error(errorMessage);
  }
  return payload;
}
