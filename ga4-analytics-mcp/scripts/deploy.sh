#!/bin/bash

# GA4 Analytics MCP Server - Railway Deployment Script
# ====================================================

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_NAME="ga4-analytics-mcp"
RAILWAY_PROJECT_ID="${RAILWAY_PROJECT_ID:-}"
RAILWAY_SERVICE_ID="${RAILWAY_SERVICE_ID:-}"
DEPLOYMENT_TIMEOUT=600  # 10 minutes
HEALTH_CHECK_RETRIES=30
HEALTH_CHECK_DELAY=10

# Functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking deployment prerequisites..."
    
    # Check if railway CLI is installed
    if ! command -v railway &> /dev/null; then
        log_error "Railway CLI is not installed. Please install it first:"
        log_error "npm install -g @railway/cli"
        exit 1
    fi
    
    # Check if authenticated with Railway
    if ! railway whoami &> /dev/null; then
        log_error "Not authenticated with Railway. Please run:"
        log_error "railway login"
        exit 1
    fi
    
    # Check if in a Railway project
    if [ -z "$RAILWAY_PROJECT_ID" ] && ! railway status &> /dev/null; then
        log_error "Not in a Railway project. Please run:"
        log_error "railway link"
        exit 1
    fi
    
    log_success "Prerequisites check passed"
}

# Pre-deployment validation
pre_deployment_validation() {
    log_info "Running pre-deployment validation..."
    
    # Check if package.json exists
    if [ ! -f "package.json" ]; then
        log_error "package.json not found. Are you in the correct directory?"
        exit 1
    fi
    
    # Verify TypeScript compilation
    log_info "Checking TypeScript compilation..."
    if ! npm run type-check; then
        log_error "TypeScript compilation failed"
        exit 1
    fi
    
    # Run build
    log_info "Building project..."
    if ! npm run build; then
        log_error "Build failed"
        exit 1
    fi
    
    # Check if required files exist
    required_files=(
        "dist/index.js"
        "railway.toml"
        "package.json"
    )
    
    for file in "${required_files[@]}"; do
        if [ ! -f "$file" ]; then
            log_error "Required file missing: $file"
            exit 1
        fi
    done
    
    log_success "Pre-deployment validation passed"
}

# Deploy to Railway
deploy_to_railway() {
    log_info "Deploying to Railway..."
    
    # Set deployment metadata
    export RAILWAY_DEPLOYMENT_DESCRIPTION="Automated deployment $(date '+%Y-%m-%d %H:%M:%S')"
    export RAILWAY_DEPLOYMENT_VERSION=$(node -p "require('./package.json').version")
    
    # Deploy with timeout
    timeout $DEPLOYMENT_TIMEOUT railway up --detach || {
        log_error "Deployment timed out after $DEPLOYMENT_TIMEOUT seconds"
        exit 1
    }
    
    log_success "Deployment initiated successfully"
}

# Wait for deployment to complete
wait_for_deployment() {
    log_info "Waiting for deployment to complete..."
    
    local retries=0
    local max_retries=60  # 10 minutes with 10-second intervals
    
    while [ $retries -lt $max_retries ]; do
        if railway status | grep -q "DEPLOYED"; then
            log_success "Deployment completed successfully"
            return 0
        fi
        
        if railway status | grep -q "FAILED"; then
            log_error "Deployment failed"
            return 1
        fi
        
        log_info "Deployment in progress... (attempt $((retries + 1))/$max_retries)"
        sleep 10
        retries=$((retries + 1))
    done
    
    log_error "Deployment status check timed out"
    return 1
}

# Health check
perform_health_check() {
    log_info "Performing health checks..."
    
    # Get deployment URL
    local deployment_url=$(railway domain 2>/dev/null | head -n1)
    
    if [ -z "$deployment_url" ]; then
        log_warning "Could not determine deployment URL, skipping external health check"
        return 0
    fi
    
    local health_url="https://${deployment_url}/health"
    local retries=0
    
    log_info "Health check URL: $health_url"
    
    while [ $retries -lt $HEALTH_CHECK_RETRIES ]; do
        log_info "Health check attempt $((retries + 1))/$HEALTH_CHECK_RETRIES..."
        
        if curl -f -s --max-time 30 "$health_url" > /dev/null; then
            log_success "Health check passed"
            
            # Detailed health check
            log_info "Fetching detailed health status..."
            curl -s "$health_url" | jq '.' || echo "Health endpoint response received"
            
            return 0
        fi
        
        log_warning "Health check failed, retrying in $HEALTH_CHECK_DELAY seconds..."
        sleep $HEALTH_CHECK_DELAY
        retries=$((retries + 1))
    done
    
    log_error "Health check failed after $HEALTH_CHECK_RETRIES attempts"
    return 1
}

# Rollback deployment
rollback_deployment() {
    log_warning "Rolling back deployment..."
    
    # Get previous deployment
    local previous_deployment=$(railway deployments --json | jq -r '.[1].id' 2>/dev/null)
    
    if [ "$previous_deployment" != "null" ] && [ -n "$previous_deployment" ]; then
        log_info "Rolling back to deployment: $previous_deployment"
        railway rollback "$previous_deployment"
        log_success "Rollback initiated"
    else
        log_error "No previous deployment found for rollback"
        return 1
    fi
}

# Post-deployment tasks
post_deployment_tasks() {
    log_info "Running post-deployment tasks..."
    
    # Display deployment information
    log_info "Deployment Information:"
    railway status
    
    # Display environment information
    log_info "Environment Variables (non-sensitive):"
    railway vars | grep -E "^(NODE_ENV|LOG_LEVEL|HEALTH_CHECK)" || log_info "No public environment variables to display"
    
    # Display resource usage
    log_info "Resource Usage:"
    railway usage || log_warning "Could not fetch resource usage"
    
    log_success "Post-deployment tasks completed"
}

# Cleanup function
cleanup() {
    log_info "Cleaning up temporary files..."
    # Add any cleanup tasks here
    log_info "Cleanup completed"
}

# Main deployment flow
main() {
    log_info "Starting deployment of $PROJECT_NAME"
    log_info "Timestamp: $(date)"
    
    # Set trap for cleanup
    trap cleanup EXIT
    
    # Run deployment steps
    check_prerequisites
    pre_deployment_validation
    deploy_to_railway
    
    # Wait for deployment
    if wait_for_deployment; then
        # Perform health check
        if perform_health_check; then
            post_deployment_tasks
            log_success "🎉 Deployment completed successfully!"
            log_info "Your GA4 Analytics MCP Server is now live"
        else
            log_error "Health check failed after deployment"
            
            # Ask for rollback
            read -p "Do you want to rollback? (y/N): " -n 1 -r
            echo
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                rollback_deployment
            fi
            exit 1
        fi
    else
        log_error "Deployment failed"
        exit 1
    fi
}

# Script options
case "${1:-}" in
    --help|-h)
        echo "GA4 Analytics MCP Server - Railway Deployment Script"
        echo ""
        echo "Usage: $0 [OPTIONS]"
        echo ""
        echo "Options:"
        echo "  --help, -h          Show this help message"
        echo "  --check, -c         Run pre-deployment checks only"
        echo "  --rollback, -r      Rollback to previous deployment"
        echo "  --health            Perform health check only"
        echo ""
        echo "Environment Variables:"
        echo "  RAILWAY_PROJECT_ID  Railway project ID (optional)"
        echo "  RAILWAY_SERVICE_ID  Railway service ID (optional)"
        echo ""
        exit 0
        ;;
    --check|-c)
        log_info "Running pre-deployment checks only..."
        check_prerequisites
        pre_deployment_validation
        log_success "Pre-deployment checks passed"
        exit 0
        ;;
    --rollback|-r)
        log_info "Rolling back deployment..."
        rollback_deployment
        exit $?
        ;;
    --health)
        log_info "Performing health check only..."
        perform_health_check
        exit $?
        ;;
    "")
        # No arguments, run full deployment
        main
        ;;
    *)
        log_error "Unknown option: $1"
        log_error "Use --help for usage information"
        exit 1
        ;;
esac