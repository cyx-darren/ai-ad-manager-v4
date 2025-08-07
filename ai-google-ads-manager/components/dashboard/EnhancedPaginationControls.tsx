/**
 * Enhanced Pagination Controls Component
 * 
 * Advanced pagination UI for campaign table with feature flag control,
 * configurable page sizes, and enhanced navigation (Phase 4 of Subtask 29.3)
 */

'use client';

import React, { useState } from 'react';

// Icons
const ChevronLeftIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
  </svg>
);

const ChevronRightIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
  </svg>
);

const ChevronDoubleLeftIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
  </svg>
);

const ChevronDoubleRightIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
  </svg>
);

const DocumentIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);

interface PaginationInfo {
  currentPage: number;
  totalPages: number;
  pageSize: number;
  totalCount: number;
  filteredCount: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

interface EnhancedPaginationControlsProps {
  paginationInfo: PaginationInfo;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onFirstPage: () => void;
  onLastPage: () => void;
  onNextPage: () => void;
  onPreviousPage: () => void;
  paginationEnabled?: boolean;
  showPageSizeOptions?: boolean;
  showGoToPage?: boolean;
  showDetailedInfo?: boolean;
  className?: string;
}

const PAGE_SIZE_OPTIONS = [
  { value: 10, label: '10 per page' },
  { value: 25, label: '25 per page' },
  { value: 50, label: '50 per page' },
  { value: 100, label: '100 per page' },
  { value: 250, label: '250 per page' }
];

export function EnhancedPaginationControls({
  paginationInfo,
  onPageChange,
  onPageSizeChange,
  onFirstPage,
  onLastPage,
  onNextPage,
  onPreviousPage,
  paginationEnabled = true,
  showPageSizeOptions = true,
  showGoToPage = true,
  showDetailedInfo = true,
  className = ''
}: EnhancedPaginationControlsProps) {

  const [goToPageValue, setGoToPageValue] = useState('');
  const [showGoToInput, setShowGoToInput] = useState(false);

  const {
    currentPage,
    totalPages,
    pageSize,
    totalCount,
    filteredCount,
    hasNextPage,
    hasPreviousPage
  } = paginationInfo;

  // Calculate display ranges
  const startItem = ((currentPage - 1) * pageSize) + 1;
  const endItem = Math.min(currentPage * pageSize, filteredCount);
  const startPercent = Math.round((startItem / filteredCount) * 100);
  const endPercent = Math.round((endItem / filteredCount) * 100);

  // Handle go to page
  const handleGoToPage = () => {
    const pageNumber = parseInt(goToPageValue);
    if (pageNumber >= 1 && pageNumber <= totalPages) {
      onPageChange(pageNumber);
      setGoToPageValue('');
      setShowGoToInput(false);
    }
  };

  // Generate page numbers for pagination display
  const getDisplayedPageNumbers = () => {
    const pages: (number | string)[] = [];
    const showPages = 7; // Total number of page buttons to show
    const sidePages = Math.floor(showPages / 2);

    if (totalPages <= showPages) {
      // Show all pages
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Show first page
      pages.push(1);

      let startPage = Math.max(2, currentPage - sidePages);
      let endPage = Math.min(totalPages - 1, currentPage + sidePages);

      // Adjust range if we're near the beginning or end
      if (currentPage <= sidePages + 1) {
        endPage = showPages - 1;
      } else if (currentPage >= totalPages - sidePages) {
        startPage = totalPages - showPages + 2;
      }

      // Add ellipsis if there's a gap after first page
      if (startPage > 2) {
        pages.push('...');
      }

      // Add middle pages
      for (let i = startPage; i <= endPage; i++) {
        pages.push(i);
      }

      // Add ellipsis if there's a gap before last page
      if (endPage < totalPages - 1) {
        pages.push('...');
      }

      // Show last page
      if (totalPages > 1) {
        pages.push(totalPages);
      }
    }

    return pages;
  };

  if (!paginationEnabled || totalPages <= 1) {
    return null;
  }

  return (
    <div className={`bg-white border-t border-gray-200 px-4 py-3 sm:px-6 ${className}`}>
      {/* Mobile Pagination */}
      <div className="flex-1 flex justify-between sm:hidden">
        <button
          onClick={onPreviousPage}
          disabled={!hasPreviousPage}
          className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ChevronLeftIcon />
          <span className="ml-1">Previous</span>
        </button>
        
        <div className="flex items-center">
          <span className="text-sm text-gray-700">
            Page {currentPage} of {totalPages}
          </span>
        </div>

        <button
          onClick={onNextPage}
          disabled={!hasNextPage}
          className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span className="mr-1">Next</span>
          <ChevronRightIcon />
        </button>
      </div>

      {/* Desktop Pagination */}
      <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
        {/* Left side - Results info and page size */}
        <div className="flex items-center space-x-4">
          {showDetailedInfo && (
            <div className="flex flex-col">
              <p className="text-sm text-gray-700">
                Showing <span className="font-medium">{startItem.toLocaleString()}</span> to{' '}
                <span className="font-medium">{endItem.toLocaleString()}</span> of{' '}
                <span className="font-medium">{filteredCount.toLocaleString()}</span> results
                {filteredCount !== totalCount && (
                  <span className="text-gray-500"> (filtered from {totalCount.toLocaleString()} total)</span>
                )}
              </p>
              <p className="text-xs text-gray-500">
                Viewing {startPercent}% - {endPercent}% of filtered results
              </p>
            </div>
          )}
          
          {showPageSizeOptions && (
            <div className="flex items-center space-x-2">
              <DocumentIcon />
              <select
                value={pageSize}
                onChange={(e) => onPageSizeChange(Number(e.target.value))}
                className="border border-gray-300 rounded-md py-1 px-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
              >
                {PAGE_SIZE_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Right side - Navigation controls */}
        <div className="flex items-center space-x-4">
          {/* Go to page */}
          {showGoToPage && (
            <div className="flex items-center space-x-2">
              {showGoToInput ? (
                <div className="flex items-center space-x-1">
                  <span className="text-sm text-gray-700">Go to:</span>
                  <input
                    type="number"
                    min="1"
                    max={totalPages}
                    value={goToPageValue}
                    onChange={(e) => setGoToPageValue(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleGoToPage()}
                    className="w-16 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder={currentPage.toString()}
                  />
                  <button
                    onClick={handleGoToPage}
                    className="px-2 py-1 bg-indigo-600 text-white text-sm rounded hover:bg-indigo-700"
                  >
                    Go
                  </button>
                  <button
                    onClick={() => {
                      setShowGoToInput(false);
                      setGoToPageValue('');
                    }}
                    className="px-2 py-1 bg-gray-300 text-gray-700 text-sm rounded hover:bg-gray-400"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowGoToInput(true)}
                  className="text-sm text-indigo-600 hover:text-indigo-800"
                >
                  Go to page...
                </button>
              )}
            </div>
          )}

          {/* Page navigation */}
          <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
            {/* First page */}
            <button
              onClick={onFirstPage}
              disabled={!hasPreviousPage}
              className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              title="First page"
            >
              <ChevronDoubleLeftIcon />
            </button>

            {/* Previous page */}
            <button
              onClick={onPreviousPage}
              disabled={!hasPreviousPage}
              className="relative inline-flex items-center px-2 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Previous page"
            >
              <ChevronLeftIcon />
            </button>

            {/* Page numbers */}
            {getDisplayedPageNumbers().map((pageNum, index) => (
              <button
                key={index}
                onClick={() => typeof pageNum === 'number' && onPageChange(pageNum)}
                disabled={pageNum === '...' || pageNum === currentPage}
                className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                  pageNum === currentPage
                    ? 'z-10 bg-indigo-50 border-indigo-500 text-indigo-600'
                    : pageNum === '...'
                    ? 'bg-white border-gray-300 text-gray-500 cursor-default'
                    : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                }`}
                title={typeof pageNum === 'number' ? `Go to page ${pageNum}` : undefined}
              >
                {pageNum}
              </button>
            ))}

            {/* Next page */}
            <button
              onClick={onNextPage}
              disabled={!hasNextPage}
              className="relative inline-flex items-center px-2 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Next page"
            >
              <ChevronRightIcon />
            </button>

            {/* Last page */}
            <button
              onClick={onLastPage}
              disabled={!hasNextPage}
              className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Last page"
            >
              <ChevronDoubleRightIcon />
            </button>
          </nav>
        </div>
      </div>

      {/* Page position indicator */}
      {showDetailedInfo && (
        <div className="mt-2 w-full bg-gray-200 rounded-full h-1">
          <div
            className="bg-indigo-600 h-1 rounded-full transition-all duration-300"
            style={{ width: `${(currentPage / totalPages) * 100}%` }}
          />
        </div>
      )}
    </div>
  );
}