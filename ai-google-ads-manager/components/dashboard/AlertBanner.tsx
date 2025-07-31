'use client'

import React from 'react'
import { 
  CheckCircleIcon, 
  ExclamationTriangleIcon, 
  InformationCircleIcon,
  XCircleIcon,
  XMarkIcon
} from '@heroicons/react/24/outline'

export type AlertType = 'success' | 'warning' | 'info' | 'error'

interface AlertBannerProps {
  type: AlertType
  title: string
  message: string
  onDismiss?: () => void
  className?: string
  actions?: React.ReactNode
}

const alertConfig = {
  success: {
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    iconColor: 'text-green-400',
    titleColor: 'text-green-800',
    messageColor: 'text-green-700',
    buttonColor: 'bg-green-50 text-green-500 hover:bg-green-100 focus:ring-green-600',
    icon: CheckCircleIcon,
  },
  warning: {
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-200',
    iconColor: 'text-yellow-400',
    titleColor: 'text-yellow-800',
    messageColor: 'text-yellow-700',
    buttonColor: 'bg-yellow-50 text-yellow-500 hover:bg-yellow-100 focus:ring-yellow-600',
    icon: ExclamationTriangleIcon,
  },
  info: {
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    iconColor: 'text-blue-400',
    titleColor: 'text-blue-800',
    messageColor: 'text-blue-700',
    buttonColor: 'bg-blue-50 text-blue-500 hover:bg-blue-100 focus:ring-blue-600',
    icon: InformationCircleIcon,
  },
  error: {
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    iconColor: 'text-red-400',
    titleColor: 'text-red-800',
    messageColor: 'text-red-700',
    buttonColor: 'bg-red-50 text-red-500 hover:bg-red-100 focus:ring-red-600',
    icon: XCircleIcon,
  },
}

export function AlertBanner({ 
  type, 
  title, 
  message, 
  onDismiss, 
  className = '',
  actions 
}: AlertBannerProps) {
  const config = alertConfig[type]
  const Icon = config.icon

  return (
    <div className={`mt-4 rounded-md border ${config.bgColor} ${config.borderColor} p-4 ${className}`}>
      <div className="flex">
        <div className="flex-shrink-0">
          <Icon className={`h-5 w-5 ${config.iconColor}`} />
        </div>
        <div className="ml-3 flex-1">
          <h3 className={`text-sm font-medium ${config.titleColor}`}>
            {title}
          </h3>
          <div className={`mt-2 text-sm ${config.messageColor}`}>
            <p>{message}</p>
          </div>
          {actions && (
            <div className="mt-4">
              {actions}
            </div>
          )}
        </div>
        {onDismiss && (
          <div className="ml-auto pl-3">
            <div className="-mx-1.5 -my-1.5">
              <button
                type="button"
                className={`inline-flex rounded-md p-1.5 ${config.buttonColor} focus:outline-none focus:ring-2 focus:ring-offset-2`}
                onClick={onDismiss}
              >
                <span className="sr-only">Dismiss</span>
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// Convenience components for specific alert types
export function SuccessAlert(props: Omit<AlertBannerProps, 'type'>) {
  return <AlertBanner {...props} type="success" />
}

export function WarningAlert(props: Omit<AlertBannerProps, 'type'>) {
  return <AlertBanner {...props} type="warning" />
}

export function InfoAlert(props: Omit<AlertBannerProps, 'type'>) {
  return <AlertBanner {...props} type="info" />
}

export function ErrorAlert(props: Omit<AlertBannerProps, 'type'>) {
  return <AlertBanner {...props} type="error" />
}