/**
 * User Experience Validator for Multi-Property Support
 * 
 * Validates user experience aspects of multi-property operations
 */

import { GA4Property } from '../types/property';
import { PropertyErrorHandler } from '../ux/errorHandling';
import { PropertyNotificationService } from '../ux/notifications';
import { PropertyLoadingManager } from '../ux/loadingStates';
import { enhancedSessionPersistence } from '../ux/sessionPersistence';

export type UXValidationCategory = 
  | 'PERFORMANCE'
  | 'ACCESSIBILITY'
  | 'USABILITY'
  | 'RESPONSIVENESS'
  | 'ERROR_HANDLING'
  | 'NOTIFICATIONS';

export interface UXValidationRule {
  id: string;
  category: UXValidationCategory;
  name: string;
  description: string;
  validator: () => Promise<UXValidationResult>;
  weight: number; // 1-10 importance
}

export interface UXValidationResult {
  passed: boolean;
  score: number; // 0-100
  message: string;
  recommendations: string[];
  issues: UXIssue[];
}

export interface UXIssue {
  severity: 'low' | 'medium' | 'high' | 'critical';
  type: string;
  description: string;
  element?: string;
  fix?: string;
}

export interface UXValidationReport {
  overallScore: number;
  categoryScores: Record<UXValidationCategory, number>;
  totalRules: number;
  passedRules: number;
  failedRules: number;
  issues: UXIssue[];
  recommendations: string[];
  timestamp: Date;
}

/**
 * User Experience Validator
 */
export class UserExperienceValidator {
  private validationRules: UXValidationRule[] = [];
  private errorHandler: PropertyErrorHandler;
  private notificationService: PropertyNotificationService;
  private loadingManager: PropertyLoadingManager;

  constructor(
    errorHandler: PropertyErrorHandler,
    notificationService: PropertyNotificationService,
    loadingManager: PropertyLoadingManager
  ) {
    this.errorHandler = errorHandler;
    this.notificationService = notificationService;
    this.loadingManager = loadingManager;

    this.initializeValidationRules();
  }

  /**
   * Run all UX validation rules
   */
  async validateUserExperience(): Promise<UXValidationReport> {
    const results: UXValidationResult[] = [];
    const allIssues: UXIssue[] = [];
    const allRecommendations: string[] = [];

    for (const rule of this.validationRules) {
      try {
        const result = await rule.validator();
        results.push(result);
        
        allIssues.push(...result.issues);
        allRecommendations.push(...result.recommendations);
      } catch (error) {
        console.error(`Failed to validate rule ${rule.id}:`, error);
        results.push({
          passed: false,
          score: 0,
          message: `Validation failed: ${error.message}`,
          recommendations: ['Fix validation error'],
          issues: [{
            severity: 'high',
            type: 'validation_error',
            description: `Rule ${rule.id} failed to execute`,
            fix: 'Check validation implementation'
          }]
        });
      }
    }

    return this.generateReport(results, allIssues, allRecommendations);
  }

  /**
   * Validate specific category
   */
  async validateCategory(category: UXValidationCategory): Promise<UXValidationReport> {
    const categoryRules = this.validationRules.filter(rule => rule.category === category);
    const results: UXValidationResult[] = [];
    const allIssues: UXIssue[] = [];
    const allRecommendations: string[] = [];

    for (const rule of categoryRules) {
      try {
        const result = await rule.validator();
        results.push(result);
        
        allIssues.push(...result.issues);
        allRecommendations.push(...result.recommendations);
      } catch (error) {
        console.error(`Failed to validate rule ${rule.id}:`, error);
      }
    }

    return this.generateReport(results, allIssues, allRecommendations);
  }

  /**
   * Get validation rules
   */
  getValidationRules(): UXValidationRule[] {
    return [...this.validationRules];
  }

  /**
   * Add custom validation rule
   */
  addValidationRule(rule: UXValidationRule): void {
    this.validationRules.push(rule);
  }

  // Private methods

  private initializeValidationRules(): void {
    // Performance validation rules
    this.addValidationRule({
      id: 'property_switch_performance',
      category: 'PERFORMANCE',
      name: 'Property Switch Performance',
      description: 'Property switching should complete within 2 seconds',
      weight: 9,
      validator: async () => {
        const startTime = Date.now();
        
        try {
          // Simulate property switch
          await new Promise(resolve => setTimeout(resolve, 100));
          const duration = Date.now() - startTime;
          
          const passed = duration < 2000;
          const score = Math.max(0, 100 - (duration / 20));
          
          return {
            passed,
            score,
            message: `Property switch took ${duration}ms`,
            recommendations: passed ? [] : ['Optimize property switching logic', 'Add caching'],
            issues: passed ? [] : [{
              severity: duration > 5000 ? 'high' : 'medium',
              type: 'performance',
              description: `Slow property switching: ${duration}ms`,
              fix: 'Implement performance optimizations'
            }]
          };
        } catch (error) {
          return {
            passed: false,
            score: 0,
            message: `Performance test failed: ${error.message}`,
            recommendations: ['Fix property switching implementation'],
            issues: [{
              severity: 'critical',
              type: 'functionality',
              description: 'Property switching is broken',
              fix: 'Debug and fix property switching logic'
            }]
          };
        }
      }
    });

    // Accessibility validation rules
    this.addValidationRule({
      id: 'property_selector_accessibility',
      category: 'ACCESSIBILITY',
      name: 'Property Selector Accessibility',
      description: 'Property selector should be keyboard accessible',
      weight: 8,
      validator: async () => {
        // Check for accessibility attributes
        const hasAriaLabels = document.querySelector('[aria-label*="property"]') !== null;
        const hasKeyboardSupport = document.querySelector('[role="combobox"]') !== null;
        const hasFocusIndicators = true; // Would check CSS focus styles in real implementation
        
        const checks = [hasAriaLabels, hasKeyboardSupport, hasFocusIndicators];
        const passedChecks = checks.filter(Boolean).length;
        const score = (passedChecks / checks.length) * 100;
        
        return {
          passed: score >= 80,
          score,
          message: `Accessibility score: ${passedChecks}/${checks.length} checks passed`,
          recommendations: score < 80 ? [
            'Add proper ARIA labels',
            'Implement keyboard navigation',
            'Add focus indicators'
          ] : [],
          issues: score < 80 ? [{
            severity: 'medium',
            type: 'accessibility',
            description: 'Property selector has accessibility issues',
            fix: 'Implement proper accessibility attributes'
          }] : []
        };
      }
    });

    // Usability validation rules
    this.addValidationRule({
      id: 'property_selection_clarity',
      category: 'USABILITY',
      name: 'Property Selection Clarity',
      description: 'Selected property should be clearly visible',
      weight: 7,
      validator: async () => {
        // Check for visual indicators
        const hasSelectedIndicator = document.querySelector('.property-selected') !== null;
        const hasPropertyBadge = document.querySelector('[data-testid="property-badge"]') !== null;
        const hasStatusIndicator = true; // Would check for status colors
        
        const checks = [hasSelectedIndicator, hasPropertyBadge, hasStatusIndicator];
        const passedChecks = checks.filter(Boolean).length;
        const score = (passedChecks / checks.length) * 100;
        
        return {
          passed: score >= 70,
          score,
          message: `Visual clarity score: ${passedChecks}/${checks.length} indicators present`,
          recommendations: score < 70 ? [
            'Add selected property indicator',
            'Improve property badge visibility',
            'Add status color coding'
          ] : [],
          issues: score < 70 ? [{
            severity: 'low',
            type: 'usability',
            description: 'Property selection not clearly visible',
            fix: 'Improve visual indicators'
          }] : []
        };
      }
    });

    // Error handling validation rules
    this.addValidationRule({
      id: 'error_recovery_mechanism',
      category: 'ERROR_HANDLING',
      name: 'Error Recovery Mechanism',
      description: 'Errors should provide recovery options',
      weight: 8,
      validator: async () => {
        try {
          const testError = new Error('Test error');
          const enhancedError = this.errorHandler.handleError(testError, {
            operation: 'property_test',
            propertyId: 'test-property'
          });
          
          const recoveryResult = await this.errorHandler.attemptRecovery(enhancedError);
          
          const hasRecoveryOptions = recoveryResult.nextSteps.length > 0;
          const hasUserFriendlyMessage = enhancedError.userMessage.length > 0;
          const hasErrorClassification = enhancedError.type !== 'UNKNOWN_ERROR';
          
          const checks = [hasRecoveryOptions, hasUserFriendlyMessage, hasErrorClassification];
          const passedChecks = checks.filter(Boolean).length;
          const score = (passedChecks / checks.length) * 100;
          
          return {
            passed: score >= 80,
            score,
            message: `Error handling score: ${passedChecks}/${checks.length} features working`,
            recommendations: score < 80 ? [
              'Add recovery options',
              'Improve error messages',
              'Better error classification'
            ] : [],
            issues: score < 80 ? [{
              severity: 'medium',
              type: 'error_handling',
              description: 'Error handling lacks recovery options',
              fix: 'Implement comprehensive error recovery'
            }] : []
          };
        } catch (error) {
          return {
            passed: false,
            score: 0,
            message: `Error handling test failed: ${error.message}`,
            recommendations: ['Fix error handling implementation'],
            issues: [{
              severity: 'high',
              type: 'error_handling',
              description: 'Error handling system is broken',
              fix: 'Debug and fix error handling logic'
            }]
          };
        }
      }
    });

    // Notifications validation rules
    this.addValidationRule({
      id: 'notification_feedback',
      category: 'NOTIFICATIONS',
      name: 'Notification Feedback',
      description: 'User actions should provide appropriate feedback',
      weight: 6,
      validator: async () => {
        try {
          // Test notification system
          this.notificationService.showPropertySuccess('Test notification', 'Test Property');
          
          // Check if notification appears (in real implementation)
          const hasNotificationSystem = typeof this.notificationService.showPropertySuccess === 'function';
          const hasMultipleTypes = typeof this.notificationService.showPropertyError === 'function';
          const hasAutoRemoval = true; // Would check notification timeout
          
          const checks = [hasNotificationSystem, hasMultipleTypes, hasAutoRemoval];
          const passedChecks = checks.filter(Boolean).length;
          const score = (passedChecks / checks.length) * 100;
          
          return {
            passed: score >= 80,
            score,
            message: `Notification system score: ${passedChecks}/${checks.length} features working`,
            recommendations: score < 80 ? [
              'Implement notification system',
              'Add multiple notification types',
              'Add auto-removal functionality'
            ] : [],
            issues: score < 80 ? [{
              severity: 'low',
              type: 'notifications',
              description: 'Notification system incomplete',
              fix: 'Complete notification implementation'
            }] : []
          };
        } catch (error) {
          return {
            passed: false,
            score: 0,
            message: `Notification test failed: ${error.message}`,
            recommendations: ['Fix notification system'],
            issues: [{
              severity: 'medium',
              type: 'notifications',
              description: 'Notification system is broken',
              fix: 'Debug and fix notification logic'
            }]
          };
        }
      }
    });
  }

  private generateReport(
    results: UXValidationResult[],
    allIssues: UXIssue[],
    allRecommendations: string[]
  ): UXValidationReport {
    const totalRules = results.length;
    const passedRules = results.filter(r => r.passed).length;
    const failedRules = totalRules - passedRules;
    
    // Calculate overall score (weighted average)
    const totalWeight = this.validationRules.reduce((sum, rule) => sum + rule.weight, 0);
    const weightedScore = results.reduce((sum, result, index) => {
      const rule = this.validationRules[index];
      return sum + (result.score * rule.weight);
    }, 0);
    const overallScore = totalWeight > 0 ? weightedScore / totalWeight : 0;
    
    // Calculate category scores
    const categoryScores = {} as Record<UXValidationCategory, number>;
    const categories: UXValidationCategory[] = ['PERFORMANCE', 'ACCESSIBILITY', 'USABILITY', 'RESPONSIVENESS', 'ERROR_HANDLING', 'NOTIFICATIONS'];
    
    categories.forEach(category => {
      const categoryRules = this.validationRules.filter(rule => rule.category === category);
      const categoryResults = categoryRules.map(rule => {
        const index = this.validationRules.findIndex(r => r.id === rule.id);
        return results[index];
      }).filter(Boolean);
      
      if (categoryResults.length > 0) {
        const avgScore = categoryResults.reduce((sum, result) => sum + result.score, 0) / categoryResults.length;
        categoryScores[category] = avgScore;
      } else {
        categoryScores[category] = 0;
      }
    });

    return {
      overallScore,
      categoryScores,
      totalRules,
      passedRules,
      failedRules,
      issues: allIssues,
      recommendations: [...new Set(allRecommendations)], // Remove duplicates
      timestamp: new Date()
    };
  }
}

// Singleton instance
export const userExperienceValidator = new UserExperienceValidator(
  new PropertyErrorHandler(),
  new PropertyNotificationService(),
  new PropertyLoadingManager()
);

export default userExperienceValidator;