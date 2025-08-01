'use client'

import React, { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { 
  HomeIcon, 
  ChartBarIcon, 
  Cog6ToothIcon,
  ArrowLeftOnRectangleIcon,
  Bars3Icon,
  XMarkIcon,
  BellIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline'
import { AlertBanner } from './AlertBanner'
import { DateRangePicker } from './DateRangePicker'
import { SettingsPanel } from './SettingsPanel'

interface DashboardLayoutProps {
  children: React.ReactNode
  title?: string
  showAlerts?: boolean
  showDatePicker?: boolean
  showSettings?: boolean
}

export function DashboardLayout({ 
  children, 
  title = "Dashboard",
  showAlerts = true,
  showDatePicker = true,
  showSettings = true
}: DashboardLayoutProps) {
  const { user, signOut, error, clearError } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isSigningOut, setIsSigningOut] = useState(false)
  
  // Debug: Log user data from AuthContext
  console.log("🏠 DashboardLayout - User:", user?.email || "No user found")

  const navigation = [
    { name: 'Overview', href: '/dashboard', icon: HomeIcon, current: true },
    { name: 'Analytics', href: '/dashboard/analytics', icon: ChartBarIcon, current: false },
    { name: 'Settings', href: '/dashboard/settings', icon: Cog6ToothIcon, current: false },
  ]

  const handleSignOut = async () => {
    setIsSigningOut(true)
    try {
      await signOut()
    } catch (err) {
      console.error('Sign out failed:', err)
    } finally {
      setIsSigningOut(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-gray-600 bg-opacity-75 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed inset-y-0 left-0 z-30 w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out
        lg:translate-x-0 lg:static lg:inset-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="flex flex-col h-full">
          {/* Sidebar header */}
          <div className="flex items-center justify-between h-16 px-4 bg-gray-900">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center">
                <ChartBarIcon className="w-5 h-5 text-white" />
              </div>
              <span className="text-white font-semibold text-lg hidden sm:block">AI Ad Manager</span>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-2 text-gray-400 hover:text-white rounded-md"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-6 space-y-2">
            {navigation.map((item) => {
              const Icon = item.icon
              return (
                <a
                  key={item.name}
                  href={item.href}
                  className={`
                    flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors duration-200
                    ${item.current 
                      ? 'bg-purple-100 text-purple-900 border-r-2 border-purple-600' 
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                    }
                  `}
                >
                  <Icon className="w-5 h-5 mr-3" />
                  {item.name}
                </a>
              )
            })}
          </nav>

          {/* User profile section */}
          <div className="border-t border-gray-200 p-4">
            <div className="flex items-center space-x-3 mb-3">
              <div className="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center">
                <span className="text-white text-sm font-medium">
                  {user?.email?.charAt(0).toUpperCase() || 'U'}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {user?.email || 'User'}
                </p>
                <p className="text-xs text-gray-500">Admin</p>
              </div>
            </div>
            <button
              onClick={handleSignOut}
              disabled={isSigningOut}
              className="flex items-center w-full px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors duration-200 disabled:opacity-50"
            >
              <ArrowLeftOnRectangleIcon className="w-4 h-4 mr-2" />
              {isSigningOut ? 'Signing out...' : 'Sign Out'}
            </button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Top header */}
        <header className="bg-white shadow-sm border-b border-gray-200">
          <div className="flex items-center justify-between px-4 sm:px-6 lg:px-8 h-16">
            {/* Left side - Mobile menu button and title */}
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md"
              >
                <Bars3Icon className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
                <p className="text-sm text-gray-500 hidden sm:block">
                  Monitor and optimize your Google Ads performance
                </p>
              </div>
            </div>

            {/* Right side - Controls */}
            <div className="flex items-center space-x-2 sm:space-x-4">
              {/* Date Range Picker */}
              {showDatePicker && (
                <div className="hidden sm:block">
                  <DateRangePicker />
                </div>
              )}

              {/* Notifications */}
              <button className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md">
                <BellIcon className="w-5 h-5" />
              </button>

              {/* Settings Panel */}
              {showSettings && <SettingsPanel />}

              {/* Refresh Button */}
              <button className="flex items-center space-x-2 px-3 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors duration-200">
                <ArrowPathIcon className="w-4 h-4" />
                <span className="hidden sm:inline text-sm font-medium">Refresh</span>
              </button>
            </div>
          </div>

          {/* Mobile Date Picker - Show on smaller screens */}
          {showDatePicker && (
            <div className="sm:hidden px-4 pb-4">
              <DateRangePicker className="w-full" />
            </div>
          )}
        </header>

        {/* Error banner */}
        {showAlerts && error && (
          <div className="px-4 sm:px-6 lg:px-8 pt-4">
            <AlertBanner
              type="error"
              title="Authentication Error"
              message={error}
              onDismiss={clearError}
            />
          </div>
        )}

        {/* Page content */}
        <main className="px-4 sm:px-6 lg:px-8 pt-4 pb-6">
          <div className="max-w-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}