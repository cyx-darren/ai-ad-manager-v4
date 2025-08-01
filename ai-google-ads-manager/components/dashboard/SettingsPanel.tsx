'use client'

import React, { useState } from 'react'
import { 
  CogIcon, 
  XMarkIcon,
  BellIcon,
  ChartBarIcon,
  EyeIcon,
  ClockIcon,
  SwatchIcon,
  DevicePhoneMobileIcon,
  ComputerDesktopIcon,
  GlobeAltIcon
} from '@heroicons/react/24/outline'
import { useDashboard } from '@/contexts/DashboardContext'

export interface SettingsPanelProps {
  className?: string
}

interface DashboardSettings {
  autoRefresh: boolean
  refreshInterval: number // in seconds
  showGridLines: boolean
  compactMode: boolean
  notifications: {
    dataUpdates: boolean
    errorAlerts: boolean
    performanceAlerts: boolean
  }
  chartSettings: {
    showDataPoints: boolean
    animateCharts: boolean
    colorScheme: 'default' | 'colorful' | 'monochrome'
  }
  layout: {
    sidebarCollapsed: boolean
    showMetricCards: boolean
    showWidgets: boolean
  }
}

export function SettingsPanel({ className = "" }: SettingsPanelProps) {
  const { state } = useDashboard()
  const [isOpen, setIsOpen] = useState(false)
  const [settings, setSettings] = useState<DashboardSettings>({
    autoRefresh: true,
    refreshInterval: 300, // 5 minutes
    showGridLines: true,
    compactMode: false,
    notifications: {
      dataUpdates: true,
      errorAlerts: true,
      performanceAlerts: false
    },
    chartSettings: {
      showDataPoints: true,
      animateCharts: true,
      colorScheme: 'default'
    },
    layout: {
      sidebarCollapsed: false,
      showMetricCards: true,
      showWidgets: true
    }
  })

  const refreshIntervalOptions = [
    { value: 30, label: '30 seconds' },
    { value: 60, label: '1 minute' },
    { value: 300, label: '5 minutes' },
    { value: 900, label: '15 minutes' },
    { value: 1800, label: '30 minutes' },
    { value: 3600, label: '1 hour' }
  ]

  const colorSchemeOptions = [
    { value: 'default', label: 'Default', description: 'Professional blue theme' },
    { value: 'colorful', label: 'Colorful', description: 'Vibrant colors for better distinction' },
    { value: 'monochrome', label: 'Monochrome', description: 'Black and white theme' }
  ]

  const updateSetting = <K extends keyof DashboardSettings>(
    key: K, 
    value: DashboardSettings[K]
  ) => {
    setSettings(prev => ({ ...prev, [key]: value }))
  }

  const updateNestedSetting = <
    K extends keyof DashboardSettings,
    NK extends keyof DashboardSettings[K]
  >(
    parentKey: K,
    nestedKey: NK,
    value: DashboardSettings[K][NK]
  ) => {
    setSettings(prev => ({
      ...prev,
      [parentKey]: {
        ...prev[parentKey],
        [nestedKey]: value
      }
    }))
  }

  const resetToDefaults = () => {
    setSettings({
      autoRefresh: true,
      refreshInterval: 300,
      showGridLines: true,
      compactMode: false,
      notifications: {
        dataUpdates: true,
        errorAlerts: true,
        performanceAlerts: false
      },
      chartSettings: {
        showDataPoints: true,
        animateCharts: true,
        colorScheme: 'default'
      },
      layout: {
        sidebarCollapsed: false,
        showMetricCards: true,
        showWidgets: true
      }
    })
  }

  return (
    <div className={`relative ${className}`}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center space-x-2 px-3 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors duration-200"
        title="Dashboard Settings"
      >
        <CogIcon className="h-5 w-5" />
        <span className="hidden sm:inline text-sm font-medium">Settings</span>
      </button>

      {/* Settings Panel Overlay */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-40"
            onClick={() => setIsOpen(false)}
          />
          
          {/* Settings Panel */}
          <div className="fixed inset-y-0 right-0 w-full sm:w-96 bg-white shadow-xl z-50 overflow-y-auto">
            <div className="p-6">
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-gray-900">Dashboard Settings</h2>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors duration-200"
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-6">
                {/* Data & Refresh Settings */}
                <section>
                  <h3 className="text-sm font-medium text-gray-900 mb-3 flex items-center">
                    <ClockIcon className="h-4 w-4 mr-2" />
                    Data & Refresh
                  </h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <label className="text-sm text-gray-700">Auto Refresh</label>
                        <p className="text-xs text-gray-500">Automatically update dashboard data</p>
                      </div>
                      <button
                        onClick={() => updateSetting('autoRefresh', !settings.autoRefresh)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          settings.autoRefresh ? 'bg-blue-600' : 'bg-gray-200'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            settings.autoRefresh ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>

                    {settings.autoRefresh && (
                      <div>
                        <label className="block text-sm text-gray-700 mb-2">Refresh Interval</label>
                        <select
                          value={settings.refreshInterval}
                          onChange={(e) => updateSetting('refreshInterval', parseInt(e.target.value))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        >
                          {refreshIntervalOptions.map(option => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                </section>

                {/* Chart Settings */}
                <section>
                  <h3 className="text-sm font-medium text-gray-900 mb-3 flex items-center">
                    <ChartBarIcon className="h-4 w-4 mr-2" />
                    Charts & Visualization
                  </h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <label className="text-sm text-gray-700">Show Data Points</label>
                        <p className="text-xs text-gray-500">Display individual data points on line charts</p>
                      </div>
                      <button
                        onClick={() => updateNestedSetting('chartSettings', 'showDataPoints', !settings.chartSettings.showDataPoints)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          settings.chartSettings.showDataPoints ? 'bg-blue-600' : 'bg-gray-200'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            settings.chartSettings.showDataPoints ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <label className="text-sm text-gray-700">Animate Charts</label>
                        <p className="text-xs text-gray-500">Enable smooth chart animations</p>
                      </div>
                      <button
                        onClick={() => updateNestedSetting('chartSettings', 'animateCharts', !settings.chartSettings.animateCharts)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          settings.chartSettings.animateCharts ? 'bg-blue-600' : 'bg-gray-200'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            settings.chartSettings.animateCharts ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>

                    <div>
                      <label className="block text-sm text-gray-700 mb-2">Color Scheme</label>
                      <div className="space-y-2">
                        {colorSchemeOptions.map(option => (
                          <button
                            key={option.value}
                            onClick={() => updateNestedSetting('chartSettings', 'colorScheme', option.value as any)}
                            className={`w-full text-left p-3 rounded-lg border transition-colors ${
                              settings.chartSettings.colorScheme === option.value
                                ? 'border-blue-500 bg-blue-50'
                                : 'border-gray-200 hover:bg-gray-50'
                            }`}
                          >
                            <div className="flex items-center space-x-3">
                              <SwatchIcon className="h-5 w-5 text-gray-400" />
                              <div>
                                <div className="text-sm font-medium text-gray-900">{option.label}</div>
                                <div className="text-xs text-gray-500">{option.description}</div>
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </section>

                {/* Layout Settings */}
                <section>
                  <h3 className="text-sm font-medium text-gray-900 mb-3 flex items-center">
                    <ComputerDesktopIcon className="h-4 w-4 mr-2" />
                    Layout & Display
                  </h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <label className="text-sm text-gray-700">Compact Mode</label>
                        <p className="text-xs text-gray-500">Reduce spacing for more content</p>
                      </div>
                      <button
                        onClick={() => updateSetting('compactMode', !settings.compactMode)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          settings.compactMode ? 'bg-blue-600' : 'bg-gray-200'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            settings.compactMode ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <label className="text-sm text-gray-700">Show Grid Lines</label>
                        <p className="text-xs text-gray-500">Display grid lines on charts</p>
                      </div>
                      <button
                        onClick={() => updateSetting('showGridLines', !settings.showGridLines)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          settings.showGridLines ? 'bg-blue-600' : 'bg-gray-200'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            settings.showGridLines ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                </section>

                {/* Notifications */}
                <section>
                  <h3 className="text-sm font-medium text-gray-900 mb-3 flex items-center">
                    <BellIcon className="h-4 w-4 mr-2" />
                    Notifications
                  </h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <label className="text-sm text-gray-700">Data Updates</label>
                        <p className="text-xs text-gray-500">Notify when data refreshes</p>
                      </div>
                      <button
                        onClick={() => updateNestedSetting('notifications', 'dataUpdates', !settings.notifications.dataUpdates)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          settings.notifications.dataUpdates ? 'bg-blue-600' : 'bg-gray-200'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            settings.notifications.dataUpdates ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <label className="text-sm text-gray-700">Error Alerts</label>
                        <p className="text-xs text-gray-500">Notify when errors occur</p>
                      </div>
                      <button
                        onClick={() => updateNestedSetting('notifications', 'errorAlerts', !settings.notifications.errorAlerts)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          settings.notifications.errorAlerts ? 'bg-blue-600' : 'bg-gray-200'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            settings.notifications.errorAlerts ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                </section>

                {/* Reset Button */}
                <div className="pt-4 border-t border-gray-200">
                  <button
                    onClick={resetToDefaults}
                    className="w-full px-4 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors duration-200"
                  >
                    Reset to Defaults
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}