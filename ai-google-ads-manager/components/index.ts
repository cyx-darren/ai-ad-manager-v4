/**
 * Main Components Index
 * 
 * Central export file for all components including property management,
 * dashboard, auth, and UI components.
 */

// Property Management Components (Phase 3 - NEW)
export { PropertySwitcher } from './PropertySwitcher';
export { PropertyBadge, PropertyBadgeList } from './PropertyBadge';
export { 
  PropertyFilters,
  PropertySearch,
  FilterDropdown,
  SortControls,
  ActiveFilterTags
} from './PropertyFilters';

// Dashboard Components (including new PropertyControls)
export * from './dashboard';

// Authentication Components
export * from './auth';

// UI Components
export * from './ui';

// Theme Test Component
export { default as ThemeTest } from './ThemeTest';

// Type exports for property components
export type {
  PropertySwitcherProps,
  PropertyBadgeProps,
  PropertyBadgeListProps,
  PropertySearchProps,
  FilterDropdownProps,
  SortControlsProps,
  ActiveFilterTagsProps,
  PropertyFiltersProps,
  PropertyControlsProps,
  WithPropertyControlsProps
} from './PropertySwitcher';

export type {
  BadgeSize,
  BadgeVariant
} from './PropertyBadge';

export type {
  PropertySearchProps as PropertySearchComponentProps,
  FilterDropdownProps as FilterDropdownComponentProps,
  SortControlsProps as SortControlsComponentProps,
  ActiveFilterTagsProps as ActiveFilterTagsComponentProps,
  PropertyFiltersProps as PropertyFiltersComponentProps
} from './PropertyFilters';