// Utility functions for Tremor chart components

// Valid Tremor v3 color names
export const TREMOR_VALID_COLORS = [
  'slate', 'gray', 'zinc', 'neutral', 'stone',
  'red', 'orange', 'amber', 'yellow', 'lime',
  'green', 'emerald', 'teal', 'cyan', 'sky',
  'blue', 'indigo', 'violet', 'purple', 'fuchsia',
  'pink', 'rose'
] as const

export type TremorColor = typeof TREMOR_VALID_COLORS[number]

// Map common color names to valid Tremor colors
const COLOR_MAPPINGS: Record<string, TremorColor> = {
  'primary': 'blue',
  'secondary': 'indigo',
  'success': 'emerald',
  'danger': 'red',
  'warning': 'amber',
  'info': 'cyan',
  'light': 'gray',
  'dark': 'slate'
}

/**
 * Validates and normalizes a color name for Tremor charts
 * @param color - The color name to validate
 * @returns A valid Tremor color name
 */
export function getTremorColor(color: string): TremorColor {
  // Check if it's already a valid Tremor color
  if (TREMOR_VALID_COLORS.includes(color as TremorColor)) {
    return color as TremorColor
  }
  
  // Check if we have a mapping for this color
  if (COLOR_MAPPINGS[color]) {
    return COLOR_MAPPINGS[color]
  }
  
  // Default to blue if color is not recognized
  return 'blue'
}

/**
 * Validates and normalizes an array of colors for Tremor charts
 * @param colors - Array of color names to validate
 * @returns Array of valid Tremor color names
 */
export function getTremorColors(colors: string[]): TremorColor[] {
  return colors.map(color => getTremorColor(color))
}

// Chart color themes for consistent styling
export const CHART_COLOR_THEMES = {
  default: ['blue', 'emerald', 'violet', 'amber', 'rose'] as TremorColor[],
  business: ['indigo', 'cyan', 'teal', 'blue', 'slate'] as TremorColor[],
  vibrant: ['blue', 'emerald', 'rose', 'violet', 'amber'] as TremorColor[],
  warm: ['orange', 'amber', 'yellow', 'red', 'rose'] as TremorColor[],
  cool: ['blue', 'cyan', 'teal', 'indigo', 'violet'] as TremorColor[],
  nature: ['green', 'emerald', 'teal', 'lime', 'cyan'] as TremorColor[],
  sunset: ['orange', 'rose', 'purple', 'pink', 'red'] as TremorColor[],
  monochrome: ['slate', 'gray', 'zinc', 'neutral', 'stone'] as TremorColor[]
}

// Color to HEX mappings for custom styling - vibrant, modern colors
export const TREMOR_COLOR_HEX: Record<TremorColor, string> = {
  slate: '#64748b',
  gray: '#6b7280',
  zinc: '#71717a',
  neutral: '#737373',
  stone: '#78716c',
  red: '#ef4444',
  orange: '#fb923c',
  amber: '#fbbf24',
  yellow: '#facc15',
  lime: '#a3e635',
  green: '#34d399',
  emerald: '#10b981',
  teal: '#14b8a6',
  cyan: '#06b6d4',
  sky: '#38bdf8',
  blue: '#3b82f6',
  indigo: '#6366f1',
  violet: '#8b5cf6',
  purple: '#a855f7',
  fuchsia: '#d946ef',
  pink: '#ec4899',
  rose: '#fb7185'
}

/**
 * Gets the HEX color value for a given color name
 * @param color - The color name or HEX value
 * @returns HEX color value
 */
export function getHexColor(color: string): string {
  // If it's already a HEX color, return as is
  if (color.startsWith('#')) {
    return color
  }
  
  // Get the valid Tremor color name
  const tremorColor = getTremorColor(color)
  
  // Return the HEX value
  return TREMOR_COLOR_HEX[tremorColor]
}