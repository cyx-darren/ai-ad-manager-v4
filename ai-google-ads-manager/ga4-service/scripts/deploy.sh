#!/bin/bash

# ============================================================================
# GA4 API Service Railway Deployment Script
# Phase 5.2.5: Production Deployment Automation
# ============================================================================

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_NAME="ga4-api-service"
RAILWAY_SERVICE="ravishing-passion"  # Your Railway project name
HEALTH_CHECK_URL="/health"
MAX_DEPLOY_WAIT=300  # 5 minutes
RETRY_INTERVAL=10

echo -e "${BLUE}============================================================================${NC}"
echo -e "${BLUE}GA4 API Service - Railway Deployment Script${NC}"
echo -e "${BLUE}Phase 5.2.5: Production Deployment${NC}"
echo -e "${BLUE}============================================================================${NC}"

# Function to log messages
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"
}

warning() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
}

# Function to check if Railway CLI is installed
check_railway_cli() {
    log "Checking Railway CLI installation..."
    if ! command -v railway &> /dev/null; then
        error "Railway CLI is not installed. Please install it first:"
        echo "npm install -g @railway/cli"
        exit 1
    fi
    log "Railway CLI found: $(railway --version)"
}

# Function to check if user is logged in to Railway
check_railway_auth() {
    log "Checking Railway authentication..."
    if ! railway whoami &> /dev/null; then
        error "Not logged in to Railway. Please login first:"
        echo "railway login"
        exit 1
    fi
    log "Railway authentication confirmed: $(railway whoami)"
}

# Function to validate environment variables
validate_environment() {
    log "Validating environment configuration..."
    
    # Critical environment variables that must be set
    REQUIRED_VARS=(
        "GA4_API_KEY"
        "SUPABASE_URL"
        "SUPABASE_ANON_KEY"
        "ALLOWED_ORIGINS"
        "GA4_SERVICE_URL"
    )
    
    missing_vars=()
    
    for var in "${REQUIRED_VARS[@]}"; do
        if ! railway variables get "$var" &> /dev/null; then
            missing_vars+=("$var")
        fi
    done
    
    if [ ${#missing_vars[@]} -ne 0 ]; then
        error "Missing required environment variables in Railway:"
        for var in "${missing_vars[@]}"; do
            echo "  - $var"
        done
        echo ""
        echo "Set them using: railway variables set <NAME>=<VALUE>"
        exit 1
    fi
    
    log "All required environment variables are configured"
}

# Function to validate service account file
validate_service_account() {
    log "Validating Google Cloud service account..."
    
    if [ ! -f "./ga4-service-account.json" ]; then
        error "Google Cloud service account file not found: ./ga4-service-account.json"
        echo "Please ensure the service account JSON file is present in the current directory"
        exit 1
    fi
    
    # Check if the file is valid JSON
    if ! python3 -m json.tool ./ga4-service-account.json > /dev/null 2>&1; then
        error "Service account file is not valid JSON"
        exit 1
    fi
    
    log "Service account file validated"
}

# Function to run pre-deployment tests
run_tests() {
    log "Running pre-deployment tests..."
    
    # Install dependencies if node_modules doesn't exist
    if [ ! -d "node_modules" ]; then
        log "Installing dependencies..."
        npm ci
    fi
    
    # Check if all required packages are installed
    log "Verifying dependencies..."
    node -e "
        const pkg = require('./package.json');
        const deps = Object.keys(pkg.dependencies);
        deps.forEach(dep => {
            try {
                require(dep);
                console.log('✅', dep);
            } catch (err) {
                console.error('❌', dep, err.message);
                process.exit(1);
            }
        });
        console.log('All dependencies verified');
    "
    
    log "Pre-deployment tests completed"
}

# Function to deploy to Railway
deploy_to_railway() {
    log "Starting Railway deployment..."
    
    # Link to the Railway project
    log "Linking to Railway project: $RAILWAY_SERVICE"
    railway link "$RAILWAY_SERVICE" || {
        error "Failed to link to Railway project"
        exit 1
    }
    
    # Deploy the service
    log "Deploying to Railway..."
    railway up --detach || {
        error "Railway deployment failed"
        exit 1
    }
    
    log "Deployment initiated successfully"
}

# Function to wait for deployment to complete
wait_for_deployment() {
    log "Waiting for deployment to complete..."
    
    local start_time=$(date +%s)
    local timeout=$((start_time + MAX_DEPLOY_WAIT))
    
    while [ $(date +%s) -lt $timeout ]; do
        # Check deployment status
        if railway status | grep -q "Active"; then
            log "Deployment completed successfully"
            return 0
        fi
        
        echo -n "."
        sleep $RETRY_INTERVAL
    done
    
    error "Deployment timeout after $MAX_DEPLOY_WAIT seconds"
    return 1
}

# Function to perform health check
health_check() {
    log "Performing health check..."
    
    # Get the service URL
    local service_url=$(railway domain | head -n 1)
    
    if [ -z "$service_url" ]; then
        error "Could not determine service URL"
        return 1
    fi
    
    log "Service URL: $service_url"
    
    # Perform health check
    local health_url="https://$service_url$HEALTH_CHECK_URL"
    log "Checking health endpoint: $health_url"
    
    local response=$(curl -s -o /dev/null -w "%{http_code}" "$health_url" || echo "000")
    
    if [ "$response" = "200" ]; then
        log "Health check passed (HTTP $response)"
        
        # Get detailed health info
        local health_info=$(curl -s "$health_url" | python3 -m json.tool 2>/dev/null || echo "{}")
        echo "Health status: $health_info"
        
        return 0
    else
        error "Health check failed (HTTP $response)"
        return 1
    fi
}

# Function to validate OAuth endpoints
validate_oauth() {
    log "Validating OAuth endpoints..."
    
    # Get the service URL
    local service_url=$(railway domain | head -n 1)
    
    if [ -z "$service_url" ]; then
        warning "Could not determine service URL for OAuth validation"
        return 1
    fi
    
    # Check auth status endpoint
    local auth_url="https://$service_url/auth/status"
    local response=$(curl -s -o /dev/null -w "%{http_code}" "$auth_url" || echo "000")
    
    if [ "$response" = "200" ]; then
        log "OAuth endpoints accessible (HTTP $response)"
        return 0
    else
        warning "OAuth endpoint check failed (HTTP $response)"
        return 1
    fi
}

# Function to show deployment summary
deployment_summary() {
    log "Deployment Summary:"
    echo "=================="
    
    # Service information
    echo "Railway Project: $RAILWAY_SERVICE"
    echo "Service URL: https://$(railway domain | head -n 1)"
    echo "Status: $(railway status | head -n 1)"
    
    # Environment
    echo "Environment: $(railway variables get NODE_ENV 2>/dev/null || echo 'Not set')"
    
    # Health endpoints
    local service_url=$(railway domain | head -n 1)
    if [ -n "$service_url" ]; then
        echo ""
        echo "Available Endpoints:"
        echo "  Health Check: https://$service_url/health"
        echo "  Auth Status:  https://$service_url/auth/status"
        echo "  OAuth Login:  https://$service_url/auth/login"
        echo "  GA4 API:      https://$service_url/api/ga4/"
    fi
    
    echo ""
    log "Deployment completed successfully! 🚀"
}

# Function to rollback deployment
rollback_deployment() {
    error "Deployment failed. Consider rolling back if needed:"
    echo "railway rollback"
}

# Main deployment flow
main() {
    log "Starting deployment process..."
    
    # Pre-deployment checks
    check_railway_cli
    check_railway_auth
    validate_environment
    validate_service_account
    run_tests
    
    # Deploy
    deploy_to_railway
    
    # Post-deployment validation
    if wait_for_deployment; then
        if health_check; then
            validate_oauth
            deployment_summary
        else
            rollback_deployment
            exit 1
        fi
    else
        rollback_deployment
        exit 1
    fi
}

# Handle script interruption
trap 'error "Deployment interrupted"; exit 1' INT TERM

# Run main function
main "$@"

# ============================================================================
# Usage Examples:
# 
# Basic deployment:
#   ./scripts/deploy.sh
# 
# Before running this script:
# 1. Install Railway CLI: npm install -g @railway/cli
# 2. Login to Railway: railway login
# 3. Set environment variables in Railway dashboard
# 4. Ensure ga4-service-account.json is in the project root
# 
# Environment Variables to Set in Railway:
# - NODE_ENV=production
# - GA4_API_KEY=your-secure-api-key
# - SUPABASE_URL=https://your-project.supabase.co
# - SUPABASE_ANON_KEY=your-supabase-anon-key
# - ALLOWED_ORIGINS=https://your-frontend.com
# - GA4_SERVICE_URL=https://your-service.railway.app
# - GOOGLE_APPLICATION_CREDENTIALS=./ga4-service-account.json
# ============================================================================