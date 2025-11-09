/**
 * Date formatting utilities using native JavaScript Intl.DateTimeFormat API
 * Replaces date-fns to reduce bundle size
 */

/**
 * Format a date string or Date object to a localized date string
 * @param date - Date string, Date object, or number (timestamp)
 * @param options - Intl.DateTimeFormatOptions
 * @param locale - Locale string (default: 'en-US')
 * @returns Formatted date string
 */
export function formatDate(
  date: string | Date | number | null | undefined,
  options: Intl.DateTimeFormatOptions = {},
  locale: string = 'en-US'
): string {
  if (!date) return '';
  
  try {
    const dateObj = typeof date === 'string' || typeof date === 'number' 
      ? new Date(date) 
      : date;
    
    if (isNaN(dateObj.getTime())) return '';
    
    return new Intl.DateTimeFormat(locale, options).format(dateObj);
  } catch {
    return '';
  }
}

/**
 * Format date to "MM/DD/YYYY" format
 */
export function formatDateShort(date: string | Date | number | null | undefined): string {
  return formatDate(date, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

/**
 * Format date to "Month Day, Year" format (e.g., "January 15, 2024")
 */
export function formatDateLong(date: string | Date | number | null | undefined): string {
  return formatDate(date, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Format date to "Mon Day, Year" format (e.g., "Jan 15, 2024")
 */
export function formatDateMedium(date: string | Date | number | null | undefined): string {
  return formatDate(date, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Format date with time (e.g., "Jan 15, 2024, 3:45 PM")
 */
export function formatDateTime(
  date: string | Date | number | null | undefined,
  includeSeconds: boolean = false
): string {
  return formatDate(date, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    ...(includeSeconds && { second: '2-digit' }),
  });
}

/**
 * Format date to relative time (e.g., "2 hours ago", "3 days ago")
 * Falls back to formatted date if older than a week
 */
export function formatRelativeTime(date: string | Date | number | null | undefined): string {
  if (!date) return '';
  
  try {
    const dateObj = typeof date === 'string' || typeof date === 'number' 
      ? new Date(date) 
      : date;
    
    if (isNaN(dateObj.getTime())) return '';
    
    const now = new Date();
    const diffMs = now.getTime() - dateObj.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    const diffWeeks = Math.floor(diffDays / 7);
    
    if (diffSecs < 60) return 'just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
    if (diffWeeks < 4) return `${diffWeeks} week${diffWeeks !== 1 ? 's' : ''} ago`;
    
    // Fall back to formatted date if older than a month
    return formatDateMedium(date);
  } catch {
    return '';
  }
}

/**
 * Calculate difference in years between two dates
 */
export function differenceInYears(
  dateLeft: string | Date | number,
  dateRight: string | Date | number = new Date()
): number {
  try {
    const left = typeof dateLeft === 'string' || typeof dateLeft === 'number' 
      ? new Date(dateLeft) 
      : dateLeft;
    const right = typeof dateRight === 'string' || typeof dateRight === 'number' 
      ? new Date(dateRight) 
      : dateRight;
    
    if (isNaN(left.getTime()) || isNaN(right.getTime())) return 0;
    
    const diffMs = Math.abs(left.getTime() - right.getTime());
    const diffYears = diffMs / (1000 * 60 * 60 * 24 * 365.25);
    
    return Math.floor(diffYears);
  } catch {
    return 0;
  }
}

/**
 * Check if a date is valid
 */
export function isValidDate(date: any): date is Date {
  if (!date) return false;
  const dateObj = date instanceof Date ? date : new Date(date);
  return !isNaN(dateObj.getTime());
}

/**
 * Format date to ISO date string (yyyy-MM-dd) for form inputs
 */
export function formatDateISO(date: string | Date | number | null | undefined): string {
  if (!date) return '';
  
  try {
    const dateObj = typeof date === 'string' || typeof date === 'number' 
      ? new Date(date) 
      : date;
    
    if (isNaN(dateObj.getTime())) return '';
    
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;
  } catch {
    return '';
  }
}

/**
 * Format date for calendar display (e.g., "EEEE" = "Monday", "MMMM" = "January")
 * Uses Intl.DateTimeFormat with formatToParts for more control
 */
export function formatDatePattern(
  date: string | Date | number | null | undefined,
  pattern: string
): string {
  if (!date) return '';
  
  try {
    const dateObj = typeof date === 'string' || typeof date === 'number' 
      ? new Date(date) 
      : date;
    
    if (isNaN(dateObj.getTime())) return '';
    
    // Map common date-fns patterns to Intl.DateTimeFormat
    const patternMap: Record<string, Intl.DateTimeFormatOptions> = {
      'EEEE': { weekday: 'long' },
      'EEE': { weekday: 'short' },
      'MMMM': { month: 'long' },
      'MMM': { month: 'short' },
      'MM': { month: '2-digit' },
      'M': { month: 'numeric' },
      'yyyy': { year: 'numeric' },
      'yy': { year: '2-digit' },
      'dd': { day: '2-digit' },
      'd': { day: 'numeric' },
    };
    
    // For simple patterns, use direct formatting
    if (pattern === 'EEEE') {
      return formatDate(dateObj, { weekday: 'long' });
    }
    if (pattern === 'MMMM') {
      return formatDate(dateObj, { month: 'long' });
    }
    if (pattern === 'yyyy') {
      return formatDate(dateObj, { year: 'numeric' });
    }
    if (pattern === 'd') {
      return formatDate(dateObj, { day: 'numeric' });
    }
    
    // For complex patterns, use formatToParts
    const formatter = new Intl.DateTimeFormat('en-US', {
      weekday: pattern.includes('EEEE') ? 'long' : pattern.includes('EEE') ? 'short' : undefined,
      year: pattern.includes('yyyy') ? 'numeric' : pattern.includes('yy') ? '2-digit' : undefined,
      month: pattern.includes('MMMM') ? 'long' : pattern.includes('MMM') ? 'short' : pattern.includes('MM') ? '2-digit' : pattern.includes('M') ? 'numeric' : undefined,
      day: pattern.includes('dd') ? '2-digit' : pattern.includes('d') ? 'numeric' : undefined,
    });
    
    const parts = formatter.formatToParts(dateObj);
    const partsMap: Record<string, string> = {};
    parts.forEach(part => {
      partsMap[part.type] = part.value;
    });
    
    // Build formatted string from pattern
    let result = pattern;
    result = result.replace(/EEEE/g, partsMap.weekday || '');
    result = result.replace(/EEE/g, partsMap.weekday?.substring(0, 3) || '');
    result = result.replace(/MMMM/g, partsMap.month || '');
    result = result.replace(/MMM/g, partsMap.month?.substring(0, 3) || '');
    result = result.replace(/MM/g, partsMap.month || '');
    result = result.replace(/M/g, partsMap.month || '');
    result = result.replace(/yyyy/g, partsMap.year || '');
    result = result.replace(/yy/g, partsMap.year?.substring(2) || '');
    result = result.replace(/dd/g, partsMap.day || '');
    result = result.replace(/d/g, partsMap.day || '');
    
    return result;
  } catch {
    return '';
  }
}

