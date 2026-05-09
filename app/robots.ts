import type { MetadataRoute } from 'next';
import { publicAppUrl } from './lib/public-url';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
    },
    sitemap: publicAppUrl('/sitemap.xml'),
  };
}
