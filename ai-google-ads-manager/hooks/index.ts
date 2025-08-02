// Phase A Authentication Hooks
export { useAuth } from '@/contexts/AuthContext'
export { useGoogleTokens, type UseGoogleTokensReturn, type GoogleTokenHealth, type GoogleTokenInfo } from './useGoogleTokens'
export { useProtectedRoute, createProtectedRoute, type UseProtectedRouteReturn, type ProtectionConfig } from './useProtectedRoute'

// Phase B Dashboard Data Hooks
export { useMetricCardsData, type MetricCardData, type MetricCardsState } from './useMetricCardsData'