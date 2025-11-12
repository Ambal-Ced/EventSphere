import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function safeRun<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

export async function safeRunAsync<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch {
    return fallback;
  }

/**
 * Utility function to delete an event image from storage
 * @param imageUrl - The full URL of the image to delete
 * @param userId - The user ID to construct the file path
 * @param supabase - Supabase client instance
 * @returns Promise<boolean> - True if deletion was successful or no image to delete, false if deletion failed
 */
export async function deleteEventImage(
  imageUrl: string | null,
  userId: string,
  supabase: any
): Promise<boolean> {
  if (!imageUrl) return true; // No image to delete

  try {
    // Extract filename from URL
    const urlParts = imageUrl.split('/');
    const filename = urlParts[urlParts.length - 1];
    
    if (filename && userId) {
      const filePath = `${userId}/${filename}`;
      const { error } = await supabase.storage
        .from("event-images")
        .remove([filePath]);
      
      if (error) {
        console.warn("Failed to delete event image:", error);
        return false;
      }
      return true;
    }
    return true;
  } catch (error) {
    console.warn("Error deleting event image:", error);
    return false;
  }
}
