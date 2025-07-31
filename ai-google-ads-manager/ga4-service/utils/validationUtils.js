/**
 * Parameter Validation Utilities for GA4 API Service
 * Phase 5.3.6: Enhanced validation and error handling
 */

const logger = require('./logger');

/**
 * Validation result structure
 * @typedef {Object} ValidationResult
 * @property {boolean} isValid - Whether validation passed
 * @property {Array<string>} errors - Array of error messages
 * @property {Object} normalized - Normalized/sanitized values
 */

class ValidationUtils {
  /**
   * Validate GA4 property ID format
   * @param {string} propertyId - Property ID to validate
   * @returns {ValidationResult}
   */
  static validatePropertyId(propertyId) {
    const errors = [];
    let normalized = propertyId;

    if (!propertyId) {
      errors.push('Property ID is required');
    } else if (typeof propertyId !== 'string') {
      errors.push('Property ID must be a string');
    } else if (!propertyId.startsWith('properties/')) {
      errors.push('Property ID must start with "properties/" (e.g., "properties/123456789")');
    } else if (!/^properties\/\d+$/.test(propertyId)) {
      errors.push('Property ID must be in format "properties/123456789" (numbers only after "properties/")');
    } else {
      // Extract numeric part for additional validation
      const numericPart = propertyId.substring(11); // Remove "properties/"
      if (numericPart.length < 9 || numericPart.length > 12) {
        errors.push('Property ID numeric part must be 9-12 digits long');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      normalized
    };
  }

  /**
   * Validate and normalize date range
   * @param {Object} dateRange - Date range object
   * @param {string} dateRange.startDate - Start date
   * @param {string} dateRange.endDate - End date
   * @returns {ValidationResult}
   */
  static validateDateRange(dateRange = {}) {
    const errors = [];
    const normalized = { ...dateRange };

    // Set defaults if not provided
    if (!normalized.startDate || !normalized.endDate) {
      const today = new Date();
      const sevenDaysAgo = new Date(today);
      sevenDaysAgo.setDate(today.getDate() - 7);
      
      normalized.startDate = normalized.startDate || sevenDaysAgo.toISOString().split('T')[0];
      normalized.endDate = normalized.endDate || today.toISOString().split('T')[0];
      
      logger.debug('Using default date range:', normalized);
    }

    // Validate date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    
    if (!dateRegex.test(normalized.startDate)) {
      errors.push('Start date must be in YYYY-MM-DD format');
    }
    
    if (!dateRegex.test(normalized.endDate)) {
      errors.push('End date must be in YYYY-MM-DD format');
    }

    // Validate date values and logic
    if (errors.length === 0) {
      const startDateObj = new Date(normalized.startDate);
      const endDateObj = new Date(normalized.endDate);
      const today = new Date();
      
      // Reset time to avoid timezone issues
      today.setHours(23, 59, 59, 999);
      
      if (isNaN(startDateObj.getTime())) {
        errors.push('Start date is not a valid date');
      }
      
      if (isNaN(endDateObj.getTime())) {
        errors.push('End date is not a valid date');
      }
      
      if (!isNaN(startDateObj.getTime()) && !isNaN(endDateObj.getTime())) {
        if (startDateObj > endDateObj) {
          errors.push('Start date must be before or equal to end date');
        }
        
        if (endDateObj > today) {
          errors.push('End date cannot be in the future');
        }
        
        // Check if date range is reasonable (not more than 2 years)
        const daysDiff = Math.ceil((endDateObj - startDateObj) / (1000 * 60 * 60 * 24));
        if (daysDiff > 730) {
          errors.push('Date range cannot exceed 2 years (730 days)');
        }
        
        if (daysDiff < 0) {
          errors.push('Invalid date range: negative duration');
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      normalized
    };
  }

  /**
   * Validate dimensions array
   * @param {Array} dimensions - Array of dimension names
   * @returns {ValidationResult}
   */
  static validateDimensions(dimensions = []) {
    const errors = [];
    const normalized = [];

    if (!Array.isArray(dimensions)) {
      errors.push('Dimensions must be an array');
      return { isValid: false, errors, normalized };
    }

    // Valid GA4 dimensions (common ones)
    const validDimensions = new Set([
      'date', 'country', 'city', 'region', 'continent', 'subContinent',
      'deviceType', 'operatingSystem', 'operatingSystemVersion', 'browser', 'browserVersion',
      'source', 'medium', 'campaign', 'campaignId', 'adContent', 'keyword',
      'sourceMedium', 'userType', 'newVsReturning', 'cohortNthDay',
      'ageGroup', 'gender', 'interests', 'eventName', 'pagePath', 'pageTitle',
      'landingPage', 'exitPage', 'pageLocation', 'pageReferrer',
      'transactionId', 'itemId', 'itemName', 'itemCategory', 'itemVariant',
      'conversionGoalId', 'conversionGoalName'
    ]);

    dimensions.forEach((dim, index) => {
      if (typeof dim !== 'string') {
        errors.push(`Dimension at index ${index} must be a string`);
      } else if (dim.trim().length === 0) {
        errors.push(`Dimension at index ${index} cannot be empty`);
      } else if (!validDimensions.has(dim.trim())) {
        errors.push(`Unknown dimension "${dim.trim()}" at index ${index}. See API documentation for valid dimensions.`);
      } else {
        normalized.push(dim.trim());
      }
    });

    // Remove duplicates
    const uniqueNormalized = [...new Set(normalized)];
    if (uniqueNormalized.length !== normalized.length) {
      logger.warn('Removed duplicate dimensions:', {
        original: normalized,
        unique: uniqueNormalized
      });
    }

    // Limit number of dimensions (GA4 has limits)
    if (uniqueNormalized.length > 10) {
      errors.push('Maximum 10 dimensions allowed per request');
    }

    return {
      isValid: errors.length === 0,
      errors,
      normalized: uniqueNormalized
    };
  }

  /**
   * Validate limit parameter
   * @param {number|string} limit - Limit value
   * @returns {ValidationResult}
   */
  static validateLimit(limit) {
    const errors = [];
    let normalized = 100; // Default limit

    if (limit === undefined || limit === null) {
      // Use default
    } else if (typeof limit === 'string') {
      const parsed = parseInt(limit, 10);
      if (isNaN(parsed)) {
        errors.push('Limit must be a valid number');
      } else {
        normalized = parsed;
      }
    } else if (typeof limit === 'number') {
      if (!Number.isInteger(limit)) {
        errors.push('Limit must be an integer');
      } else {
        normalized = limit;
      }
    } else {
      errors.push('Limit must be a number');
    }

    // Validate range
    if (errors.length === 0) {
      if (normalized < 1) {
        errors.push('Limit must be at least 1');
      } else if (normalized > 100000) {
        errors.push('Limit cannot exceed 100,000');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      normalized
    };
  }

  /**
   * Comprehensive parameter validation for GA4 requests
   * @param {string} propertyId - GA4 property ID
   * @param {Object} options - Request options
   * @returns {ValidationResult}
   */
  static validateGA4Request(propertyId, options = {}) {
    const allErrors = [];
    const normalized = {};

    // Validate property ID
    const propertyValidation = this.validatePropertyId(propertyId);
    if (!propertyValidation.isValid) {
      allErrors.push(...propertyValidation.errors);
    } else {
      normalized.propertyId = propertyValidation.normalized;
    }

    // Validate date range
    const dateValidation = this.validateDateRange({
      startDate: options.startDate,
      endDate: options.endDate
    });
    if (!dateValidation.isValid) {
      allErrors.push(...dateValidation.errors);
    } else {
      normalized.dateRange = dateValidation.normalized;
    }

    // Validate dimensions
    const dimensionsValidation = this.validateDimensions(options.dimensions);
    if (!dimensionsValidation.isValid) {
      allErrors.push(...dimensionsValidation.errors);
    } else {
      normalized.dimensions = dimensionsValidation.normalized;
    }

    // Validate limit
    const limitValidation = this.validateLimit(options.limit);
    if (!limitValidation.isValid) {
      allErrors.push(...limitValidation.errors);
    } else {
      normalized.limit = limitValidation.normalized;
    }

    return {
      isValid: allErrors.length === 0,
      errors: allErrors,
      normalized
    };
  }

  /**
   * Sanitize and validate request options
   * @param {Object} options - Raw request options
   * @returns {Object} Sanitized options
   */
  static sanitizeOptions(options = {}) {
    const sanitized = {};

    // Sanitize startDate
    if (options.startDate && typeof options.startDate === 'string') {
      sanitized.startDate = options.startDate.trim();
    }

    // Sanitize endDate
    if (options.endDate && typeof options.endDate === 'string') {
      sanitized.endDate = options.endDate.trim();
    }

    // Sanitize dimensions
    if (options.dimensions) {
      if (Array.isArray(options.dimensions)) {
        sanitized.dimensions = options.dimensions;
      } else if (typeof options.dimensions === 'string') {
        sanitized.dimensions = options.dimensions.split(',').map(d => d.trim()).filter(d => d.length > 0);
      }
    }

    // Sanitize limit
    if (options.limit !== undefined) {
      sanitized.limit = options.limit;
    }

    return sanitized;
  }
}

module.exports = { ValidationUtils };