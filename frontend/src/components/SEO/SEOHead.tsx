import { useEffect, useLayoutEffect } from 'react';

interface SEOHeadProps {
  title?: string;
  description?: string;
  keywords?: string;
  image?: string;
  url?: string;
  type?: 'website' | 'product' | 'article';
  product?: {
    name: string;
    price: number;
    currency?: string;
    condition?: string;
    brand?: string;
    image?: string;
    availability?: 'InStock' | 'OutOfStock';
  };
}

export function SEOHead({
  title,
  description,
  keywords,
  image = 'https://bikewerk.ru/og-image.jpg',
  url,
  type = 'website',
  product
}: SEOHeadProps) {
  // Use useLayoutEffect to update title synchronously before paint
  useLayoutEffect(() => {
    if (title && typeof document !== 'undefined') {
      document.title = title;
      const titleTag = document.querySelector('title');
      if (titleTag) {
        titleTag.textContent = title;
      }
    }
  }, [title]);

  useEffect(() => {
    // Update title immediately (synchronous)
    if (title) {
      document.title = title;
    }
    
    // Also update title tag if it exists
    const titleTag = document.querySelector('title');
    if (titleTag && title) {
      titleTag.textContent = title;
    }

    // Update or create meta tags
    const updateMeta = (name: string, content: string, isProperty = false) => {
      const selector = isProperty ? `meta[property="${name}"]` : `meta[name="${name}"]`;
      let meta = document.querySelector(selector) as HTMLMetaElement;
      if (!meta) {
        meta = document.createElement('meta');
        if (isProperty) {
          meta.setAttribute('property', name);
        } else {
          meta.setAttribute('name', name);
        }
        document.head.appendChild(meta);
      }
      meta.setAttribute('content', content);
    };

    // Basic meta
    if (description) {
      updateMeta('description', description);
      updateMeta('og:description', description, true);
      updateMeta('twitter:description', description);
    }

    if (keywords) {
      updateMeta('keywords', keywords);
    }

    // Open Graph
    if (title) {
      updateMeta('og:title', title, true);
      updateMeta('twitter:title', title);
    }

    if (url) {
      updateMeta('og:url', url, true);
    }

    updateMeta('og:image', image, true);
    updateMeta('twitter:image', image);
    updateMeta('og:type', type, true);

    // Schema.org structured data for products
    if (product && type === 'product') {
      const schema = {
        '@context': 'https://schema.org/',
        '@type': 'Product',
        name: product.name,
        image: product.image || image,
        description: description || '',
        brand: product.brand ? {
          '@type': 'Brand',
          name: product.brand
        } : undefined,
        offers: {
          '@type': 'Offer',
          url: url || window.location.href,
          priceCurrency: product.currency || 'RUB',
          price: product.price.toString(),
          itemCondition: product.condition === 'new' 
            ? 'https://schema.org/NewCondition'
            : 'https://schema.org/UsedCondition',
          availability: product.availability === 'InStock'
            ? 'https://schema.org/InStock'
            : 'https://schema.org/OutOfStock'
        }
      };

      // Remove existing schema script
      const existingSchema = document.querySelector('script[type="application/ld+json"]');
      if (existingSchema) {
        existingSchema.remove();
      }

      // Add new schema script
      const script = document.createElement('script');
      script.type = 'application/ld+json';
      script.textContent = JSON.stringify(schema);
      document.head.appendChild(script);
    }
  }, [title, description, keywords, image, url, type, product]);

  return null;
}
