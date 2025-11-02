# Webpage Load Performance Optimization Guide

This document outlines specific optimizations to enhance your webpage load times.

## 🚀 Quick Wins (Implement First)

### 1. **Image Optimization**
- **Current Issue**: Images are loaded from Supabase storage without optimization
- **Solution**: Add Next.js Image optimization features

```typescript
// In next.config.js - Add image optimization
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  images: {
    remotePatterns: [
      // ... existing patterns
    ],
    formats: ['image/avif', 'image/webp'], // Modern formats
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60 * 60 * 24 * 30, // 30 days
    dangerouslyAllowSVG: false,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
  // Enable compression
  compress: true,
};
```

### 2. **Enable Static Generation Where Possible**
- Convert client components to server components for static pages
- Use `generateStaticParams` for dynamic routes when possible

### 3. **Code Splitting & Lazy Loading**
- Implement dynamic imports for heavy components
- Lazy load below-the-fold content

### 4. **Database Query Optimization**
- Add query result caching
- Implement pagination for large lists
- Use `select()` to only fetch needed columns

### 5. **Reduce Bundle Size**
- Analyze bundle with `npm run build -- --analyze`
- Remove unused dependencies
- Use tree-shaking friendly imports

---

## 📋 Detailed Optimization Plan

### **1. Image Optimization**

**Priority: HIGH**

#### A. Update `next.config.js`:
```javascript
const nextConfig = {
  // ... existing config
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60 * 60 * 24 * 30,
    unoptimized: false, // Keep optimization enabled
  },
};
```

#### B. Add loading="lazy" to images:
```typescript
<Image
  src={event.image_url}
  alt={event.title}
  fill
  className="object-cover"
  loading="lazy" // Add this
  placeholder="blur" // Add blur placeholder
  blurDataURL="data:image/..." // Add base64 blur
/>
```

#### C. Implement responsive images:
```typescript
<Image
  src={event.image_url}
  alt={event.title}
  width={800}
  height={600}
  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
  className="object-cover"
  loading="lazy"
/>
```

---

### **2. Code Splitting & Lazy Loading**

**Priority: HIGH**

#### A. Lazy load heavy components:
```typescript
// Instead of direct import
import AnalyticsPage from '@/app/analytics/page';

// Use dynamic import
const AnalyticsPage = dynamic(() => import('@/app/analytics/page'), {
  loading: () => <div>Loading...</div>,
  ssr: false, // If component doesn't need SSR
});
```

#### B. Lazy load modals/dialogs:
```typescript
const TermsDialog = dynamic(() => import('@/components/TermsDialog'), {
  ssr: false,
});
```

#### C. Route-based code splitting (already done by Next.js, but optimize):
- Move heavy libraries to dynamic imports
- Lazy load third-party components (charts, editors, etc.)

---

### **3. Database Query Optimization**

**Priority: HIGH**

#### A. Add query result caching:
```typescript
// Create a query cache utility
import { cache } from 'react';

export const getCachedEvents = cache(async (userId: string) => {
  // Cache queries at request level
  const { data } = await supabase
    .from('events')
    .select('id,title,date,category')
    .eq('user_id', userId)
    .limit(50); // Add limits
  
  return data;
});
```

#### B. Use `select()` to fetch only needed columns:
```typescript
// Instead of: .select('*')
// Use specific columns:
.select('id,title,date,category,location,image_url')
```

#### C. Implement pagination:
```typescript
const ITEMS_PER_PAGE = 20;

const fetchEvents = async (page: number = 1) => {
  const from = (page - 1) * ITEMS_PER_PAGE;
  const to = from + ITEMS_PER_PAGE - 1;
  
  const { data } = await supabase
    .from('events')
    .select('*')
    .range(from, to)
    .order('created_at', { ascending: false });
    
  return data;
};
```

#### D. Batch multiple queries:
```typescript
// Instead of multiple separate queries
const [events, collaborators, items] = await Promise.all([
  supabase.from('events').select('*').eq('user_id', userId),
  supabase.from('event_collaborators').select('*').eq('user_id', userId),
  supabase.from('event_items').select('*').in('event_id', eventIds),
]);
```

---

### **4. Reduce Initial Bundle Size**

**Priority: MEDIUM**

#### A. Analyze bundle:
```bash
npm install --save-dev @next/bundle-analyzer
```

Update `next.config.js`:
```javascript
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

module.exports = withBundleAnalyzer(nextConfig);
```

Run: `ANALYZE=true npm run build`

#### B. Remove unused dependencies:
- Check `package.json` for unused imports
- Replace large libraries with lighter alternatives

#### C. Use tree-shaking friendly imports:
```typescript
// Instead of:
import * as lucide from 'lucide-react';

// Use:
import { User, Settings } from 'lucide-react';
```

---

### **5. Optimize React Components**

**Priority: MEDIUM**

#### A. Memoize expensive computations:
```typescript
// Already using useMemo - good!
const filteredEvents = useMemo(() => {
  // ... filtering logic
}, [events, searchQuery, categoryFilter, showDone, showArchived]);
```

#### B. Avoid unnecessary re-renders:
```typescript
// Use React.memo for expensive components
export const EventCard = React.memo(({ event }: { event: Event }) => {
  // Component code
});
```

#### C. Debounce search inputs:
```typescript
import { useDebounce } from '@/hooks/useDebounce';

const [searchQuery, setSearchQuery] = useState('');
const debouncedSearch = useDebounce(searchQuery, 300);

useEffect(() => {
  // Fetch with debouncedSearch instead of searchQuery
}, [debouncedSearch]);
```

---

### **6. Caching Strategy**

**Priority: MEDIUM**

#### A. Add service worker for offline support:
```typescript
// public/sw.js
self.addEventListener('fetch', (event) => {
  // Cache static assets
});
```

#### B. Use React Cache API (Next.js 14):
```typescript
import { cache } from 'react';

export const getEvents = cache(async () => {
  // This function is automatically cached
});
```

#### C. Implement SWR or React Query:
```bash
npm install swr
```

```typescript
import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then(res => res.json());

function EventsPage() {
  const { data, error } = useSWR('/api/events', fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: true,
    dedupingInterval: 5000, // 5 seconds
  });
  
  // ...
}
```

---

### **7. Preloading & Prefetching**

**Priority: LOW**

#### A. Prefetch routes on hover:
```typescript
<Link href="/events" prefetch={true}>
  Events
</Link>
```

#### B. Preload critical resources:
```typescript
// In layout.tsx or page.tsx
<Head>
  <link rel="preload" href="/fonts/main-font.woff2" as="font" crossOrigin="" />
  <link rel="preload" href="/api/user" as="fetch" crossOrigin="" />
</Head>
```

---

### **8. Performance Monitoring**

**Priority: LOW**

#### A. Add Web Vitals tracking:
```bash
npm install web-vitals
```

```typescript
import { getCLS, getFID, getFCP, getLCP, getTTFB } from 'web-vitals';

function sendToAnalytics(metric: any) {
  // Send to your analytics
  console.log(metric);
}

getCLS(sendToAnalytics);
getFID(sendToAnalytics);
getFCP(sendToAnalytics);
getLCP(sendToAnalytics);
getTTFB(sendToAnalytics);
```

---

## 📊 Implementation Priority

### Week 1 (High Impact):
1. ✅ Image optimization (Next.js Image component)
2. ✅ Database query optimization (select only needed columns)
3. ✅ Add pagination to event lists

### Week 2 (Medium Impact):
4. ✅ Lazy load heavy components
5. ✅ Implement query result caching
6. ✅ Debounce search inputs

### Week 3 (Nice to Have):
7. ✅ Bundle size optimization
8. ✅ Add service worker for caching
9. ✅ Performance monitoring

---

## 🛠️ Tools to Use

1. **Next.js Bundle Analyzer** - Analyze bundle size
2. **Lighthouse** - Performance auditing
3. **WebPageTest** - Real-world performance testing
4. **React DevTools Profiler** - Find performance bottlenecks
5. **Chrome Performance Tab** - Identify slow operations

---

## 📈 Expected Improvements

- **Initial Load Time**: 40-60% reduction
- **Time to Interactive**: 30-50% improvement
- **First Contentful Paint**: 50-70% faster
- **Bundle Size**: 20-30% reduction
- **Database Query Time**: 30-40% faster with proper indexes

---

## 🔍 Quick Checks

Run these to see current performance:
```bash
# Build and analyze
npm run build

# Check bundle size
npm install --save-dev @next/bundle-analyzer
ANALYZE=true npm run build

# Lighthouse audit
npx lighthouse https://your-domain.com
```

---

## ✅ Checklist

- [ ] Optimize images with Next.js Image component
- [ ] Add lazy loading to images and components
- [ ] Implement pagination for large lists
- [ ] Use `select()` to fetch only needed columns
- [ ] Add query result caching
- [ ] Debounce search inputs
- [ ] Analyze and reduce bundle size
- [ ] Memoize expensive computations
- [ ] Prefetch routes on hover
- [ ] Add performance monitoring

