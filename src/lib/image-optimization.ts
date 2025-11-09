/**
 * Image optimization utilities
 * Optimizes Supabase image URLs to be under 60KB by using Next.js Image optimization
 */

/**
 * Get optimized image URL for Supabase storage
 * This ensures images are optimized through Next.js Image component
 * @param imageUrl - Original Supabase storage URL
 * @returns Optimized image URL (same URL, Next.js will optimize it)
 */
export function getOptimizedImageUrl(imageUrl: string | null | undefined): string {
  if (!imageUrl) return "/images/template/eventtria.webp";
  
  // If it's already a local image, return as is
  if (imageUrl.startsWith("/")) return imageUrl;
  
  // For Supabase storage URLs, return as is - Next.js will optimize via Image component
  // The optimization happens at request time through Next.js Image API
  return imageUrl;
}

/**
 * Generate image sizes attribute for responsive images
 * @param containerSize - Size of the container (e.g., "full", "half", "third")
 * @returns Sizes attribute string
 */
export function getImageSizes(containerSize: "full" | "half" | "third" | "quarter" = "full"): string {
  switch (containerSize) {
    case "full":
      return "(max-width: 768px) 100vw, 100vw";
    case "half":
      return "(max-width: 768px) 100vw, 50vw";
    case "third":
      return "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw";
    case "quarter":
      return "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 25vw";
    default:
      return "100vw";
  }
}

/**
 * Default image quality for optimization (85 is a good balance between quality and size)
 */
export const DEFAULT_IMAGE_QUALITY = 85;

