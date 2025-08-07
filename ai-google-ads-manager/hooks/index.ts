// Phase A Authentication Hooks
export { useAuth } from '@/contexts/AuthContext'
export { useGoogleTokens, type UseGoogleTokensReturn, type GoogleTokenHealth, type GoogleTokenInfo } from './useGoogleTokens'
export { useProtectedRoute, createProtectedRoute, type UseProtectedRouteReturn, type ProtectionConfig } from './useProtectedRoute'

// Campaign Table Hooks (Subtask 29.3)
export { useCampaignTableData, useCampaignTable, useCampaignExport } from './useCampaignTableData'
export { useTableViewPreferences } from './useTableViewPreferences'
export { usePerformanceOptimizedTable } from './usePerformanceOptimizedTable'