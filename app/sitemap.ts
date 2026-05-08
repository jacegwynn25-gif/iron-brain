import type { MetadataRoute } from 'next';

const BASE_URL = 'https://iron-brain.vercel.app';

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  return ['/', '/login', '/privacy', '/terms'].map((path) => ({
    url: `${BASE_URL}${path}`,
    lastModified: now,
    changeFrequency: path === '/' ? 'weekly' : 'monthly',
    priority: path === '/' ? 1 : 0.4,
  }));
}

