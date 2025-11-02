'use client';

import { useEffect } from 'react';
import { onCLS, onINP, onFCP, onLCP, onTTFB } from 'web-vitals';

function sendToAnalytics(metric: any) {
  // Send to your analytics service
  // For now, just log to console
  console.log('Web Vital:', {
    name: metric.name,
    value: metric.value,
    id: metric.id,
    rating: metric.rating,
  });
  
  // You can send to analytics service here:
  // if (typeof window !== 'undefined' && window.gtag) {
  //   window.gtag('event', metric.name, {
  //     value: Math.round(metric.name === 'CLS' ? metric.value * 1000 : metric.value),
  //     event_category: 'Web Vitals',
  //     event_label: metric.id,
  //     non_interaction: true,
  //   });
  // }
}

export function WebVitals() {
  useEffect(() => {
    // Use on* functions from web-vitals v5 API
    // Note: onFID is replaced by onINP in v5
    onCLS(sendToAnalytics); // Cumulative Layout Shift
    onINP(sendToAnalytics); // Interaction to Next Paint (replaces FID)
    onFCP(sendToAnalytics); // First Contentful Paint
    onLCP(sendToAnalytics); // Largest Contentful Paint
    onTTFB(sendToAnalytics); // Time to First Byte
  }, []);

  return null;
}

