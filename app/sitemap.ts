import type { MetadataRoute } from 'next';
import { publicAppUrl } from './lib/public-url';

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  return ['/', '/login', '/privacy', '/terms'].map((path) => ({
    url: publicAppUrl(path),
    lastModified: now,
    changeFrequency: path === '/' ? 'weekly' : 'monthly',
    priority: path === '/' ? 1 : 0.4,
  }));
}
