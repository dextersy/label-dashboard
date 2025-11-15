import { Injectable, Inject, DOCUMENT } from '@angular/core';
import { Title, Meta } from '@angular/platform-browser';
import { Location } from '@angular/common';

export interface PageMetadata {
  title?: string;
  description?: string;
  image?: string;
  url?: string;
  type?: string;
  siteName?: string;
  twitterCard?: 'summary' | 'summary_large_image' | 'app' | 'player';
}

@Injectable({
  providedIn: 'root'
})
export class MetaService {

  constructor(
    private title: Title,
    private meta: Meta,
    private location: Location,
    @Inject(DOCUMENT) private document: Document
  ) {}

  updatePageMetadata(metadata: PageMetadata): void {
    // Update page title
    if (metadata.title) {
      this.title.setTitle(metadata.title);
    }

    // Update basic meta tags
    if (metadata.description) {
      this.updateMetaTag('name', 'description', metadata.description);
    }

    // Update Open Graph meta tags
    if (metadata.title) {
      this.updateMetaTag('property', 'og:title', metadata.title);
    }
    if (metadata.description) {
      this.updateMetaTag('property', 'og:description', metadata.description);
    }
    if (metadata.image) {
      this.updateMetaTag('property', 'og:image', metadata.image);
    }
    // Set URL to current page if not provided
    const url = metadata.url || window.location.href;
    this.updateMetaTag('property', 'og:url', url);
    
    // Add canonical URL
    this.updateCanonicalUrl(url);
    if (metadata.type) {
      this.updateMetaTag('property', 'og:type', metadata.type);
    } else {
      this.updateMetaTag('property', 'og:type', 'website');
    }
    if (metadata.siteName) {
      this.updateMetaTag('property', 'og:site_name', metadata.siteName);
    }

    // Update Twitter Card meta tags
    this.updateMetaTag('name', 'twitter:card', metadata.twitterCard || 'summary_large_image');
    if (metadata.title) {
      this.updateMetaTag('name', 'twitter:title', metadata.title);
    }
    if (metadata.description) {
      this.updateMetaTag('name', 'twitter:description', metadata.description);
    }
    if (metadata.image) {
      this.updateMetaTag('name', 'twitter:image', metadata.image);
    }
  }

  updateEventTicketMetadata(event: any, brandName?: string): void {
    const title = `Buy tickets to ${event.title}`;
    const description = event.description || `Get your tickets for ${event.title} at ${event.venue || 'this amazing event'}.`;
    const image = event.poster_url;
    const siteName = brandName || 'Melt Records';

    const metadata: PageMetadata = {
      title,
      description,
      image,
      type: 'website',
      siteName,
      twitterCard: 'summary_large_image'
    };

    this.updatePageMetadata(metadata);
    
    // Add structured data for better SEO
    this.addEventStructuredData(event, brandName);
  }

  clearMetadata(): void {
    // Remove Open Graph tags
    this.removeMetaTag('property', 'og:title');
    this.removeMetaTag('property', 'og:description');
    this.removeMetaTag('property', 'og:image');
    this.removeMetaTag('property', 'og:url');
    this.removeMetaTag('property', 'og:type');
    this.removeMetaTag('property', 'og:site_name');

    // Remove Twitter Card tags
    this.removeMetaTag('name', 'twitter:card');
    this.removeMetaTag('name', 'twitter:title');
    this.removeMetaTag('name', 'twitter:description');
    this.removeMetaTag('name', 'twitter:image');

    // Remove description
    this.removeMetaTag('name', 'description');
    
    // Remove structured data and canonical URL
    this.removeStructuredData();
    const existingCanonical = this.document.querySelector('link[rel="canonical"]');
    if (existingCanonical) {
      existingCanonical.remove();
    }
  }

  private updateMetaTag(attrName: string, attrValue: string, content: string): void {
    if (this.meta.getTag(`${attrName}="${attrValue}"`)) {
      this.meta.updateTag({ [attrName]: attrValue, content });
    } else {
      this.meta.addTag({ [attrName]: attrValue, content });
    }
  }

  private removeMetaTag(attrName: string, attrValue: string): void {
    this.meta.removeTag(`${attrName}="${attrValue}"`);
  }

  private updateCanonicalUrl(url: string): void {
    // Remove existing canonical link
    const existingCanonical = this.document.querySelector('link[rel="canonical"]');
    if (existingCanonical) {
      existingCanonical.remove();
    }

    // Add new canonical link
    const link = this.document.createElement('link');
    link.setAttribute('rel', 'canonical');
    link.setAttribute('href', url);
    this.document.head.appendChild(link);
  }

  addEventStructuredData(event: any, brandName?: string): void {
    // Remove existing structured data
    this.removeStructuredData();

    const structuredData = {
      "@context": "https://schema.org",
      "@type": "Event",
      "name": event.title,
      "description": event.description || `Get your tickets for ${event.title}`,
      "startDate": event.date_and_time,
      "location": {
        "@type": "Place",
        "name": event.venue
      },
      "image": event.poster_url,
      "offers": {
        "@type": "Offer",
        "price": event.ticket_price,
        "priceCurrency": "PHP",
        "availability": "https://schema.org/InStock",
        "url": window.location.href
      },
      "organizer": {
        "@type": "Organization",
        "name": brandName || "Event Organizer"
      }
    };

    const script = this.document.createElement('script');
    script.type = 'application/ld+json';
    script.textContent = JSON.stringify(structuredData);
    script.id = 'event-structured-data';
    this.document.head.appendChild(script);
  }

  private removeStructuredData(): void {
    const existingScript = this.document.querySelector('#event-structured-data');
    if (existingScript) {
      existingScript.remove();
    }
  }
}