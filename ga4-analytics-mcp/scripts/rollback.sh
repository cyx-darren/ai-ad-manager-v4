#!/bin/bash

# GA4 Analytics MCP Server - Railway Rollback Script
# ==================================================

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_NAME="ga4-analytics-mcp"
HEALTH_CHECK_RETRIES=20
HEALTH_CHECK_DELAY=15

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

# Check if Railway CLI is available
check_railway_cli() {
    if ! command -v railway &> /dev/null; then
        log_error "Railway CLI is not installed. Please install it first:"
        log_error "npm install -g @railway/cli"
        exit 1
    fi
    
    if ! railway whoami &> /dev/null; then
        log_error "Not authenticated with Railway. Please run:"
        log_error "railway login"
        exit 1
    fi
}

# List available deployments
list_deployments() {
    log_info "Fetching deployment history..."
    
    if ! railway deployments --json > /tmp/deployments.json 2>/dev/null; then
        log_error "Failed to fetch deployments"
        exit 1
    fi
    
    echo
    log_info "Available deployments:"
    echo "======================================================"
    
    # Parse and display deployments
    jq -r '.[] | "\(.id) | \(.status) | \(.createdAt) | \(.meta.description // "No description")"' /tmp/deployments.json | head -10 | while IFS='|' read -r id status created desc; do
        # Color code by status
        case "$status" in
            "DEPLOYED"|"SUCCESS")
                status_color="${GREEN}$status${NC}"
                ;;
            "FAILED"|"ERROR")
                status_color="${RED}$status${NC}"
                ;;
            *)
                status_color="${YELLOW}$status${NC}"
                ;;
        esac
        
        # Format created date
        created_formatted=$(date -d "$created" '+%Y-%m-%d %H:%M:%S' 2>/dev/null || echo "$created")
        
        printf "%-12s | %s | %s | %s\n" "$id" "$status_color" "$created_formatted" "$desc"
    done
    
    echo "======================================================"
    echo
}

# Get current deployment
get_current_deployment() {
    railway deployments --json | jq -r '.[0].id' 2>/dev/null
}

# Get previous successful deployment
get_previous_deployment() {
    railway deployments --json | jq -r '.[] | select(.status == "DEPLOYED" or .status == "SUCCESS") | .id' | head -2 | tail -1 2>/dev/null
}

# Perform rollback
perform_rollback() {
    local target_deployment="$1"
    local current_deployment
    
    current_deployment=$(get_current_deployment)
    
    if [ "$target_deployment" = "$current_deployment" ]; then
        log_warning "Target deployment is the same as current deployment"
        read -p "Continue anyway? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log_info "Rollback cancelled"
            exit 0
        fi
    fi
    
    log_info "Rolling back to deployment: $target_deployment"
    log_info "Current deployment: $current_deployment"
    
    # Confirm rollback
    echo
    log_warning "⚠️  This will rollback your application to a previous version."
    log_warning "⚠️  Any changes made since then will be lost until redeployed."
    echo
    read -p "Are you sure you want to proceed? (y/N): " -n 1 -r
    echo
    
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_info "Rollback cancelled"
        exit 0
    fi
    
    # Create backup information
    log_info "Creating rollback metadata..."
    cat > /tmp/rollback-info.json << EOF
{
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "rollback_from": "$current_deployment",
    "rollback_to": "$target_deployment",
    "rollback_reason": "Manual rollback via script",
    "operator": "$(whoami)"
}
EOF
    
    # Perform the rollback
    log_info "Executing rollback..."
    if railway rollback "$target_deployment"; then
        log_success "Rollback command executed successfully"
        return 0
    else
        log_error "Rollback command failed"
        return 1
    fi
}

# Wait for rollback to complete
wait_for_rollback() {
    local target_deployment="$1"
    local retries=0
    local max_retries=30  # 5 minutes with 10-second intervals
    
    log_info "Waiting for rollback to complete..."
    
    while [ $retries -lt $max_retries ]; do
        local current_deployment
        current_deployment=$(get_current_deployment)
        
        if [ "$current_deployment" = "$target_deployment" ]; then
            log_success "Rollback completed successfully"
            return 0
        fi
        
        if railway status | grep -q "FAILED"; then
            log_error "Rollback failed"
            return 1
        fi
        
        log_info "Rollback in progress... (attempt $((retries + 1))/$max_retries)"
        sleep 10
        retries=$((retries + 1))
    done
    
    log_error "Rollback status check timed out"
    return 1
}

# Perform health check after rollback
perform_health_check() {
    log_info "Performing post-rollback health checks..."
    
    # Get deployment URL
    local deployment_url
    deployment_url=$(railway domain 2>/dev/null | head -n1)
    
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
            
            # Get detailed health status
            log_info "Fetching detailed health status..."
            local health_response
            health_response=$(curl -s "$health_url" 2>/dev/null)
            
            if command -v jq &> /dev/null && echo "$health_response" | jq . >/dev/null 2>&1; then
                echo "$health_response" | jq '.'
            else
                echo "$health_response"
            fi
            
            return 0
        fi
        
        log_warning "Health check failed, retrying in $HEALTH_CHECK_DELAY seconds..."
        sleep $HEALTH_CHECK_DELAY
        retries=$((retries + 1))
    done
    
    log_error "Health check failed after $HEALTH_CHECK_RETRIES attempts"
    log_error "The rollback may have succeeded, but the service is not responding"
    return 1
}

# Emergency rollback (latest successful deployment)
emergency_rollback() {
    log_warning "🚨 Performing emergency rollback to last known good deployment"
    
    local previous_deployment
    previous_deployment=$(get_previous_deployment)
    
    if [ -z "$previous_deployment" ] || [ "$previous_deployment" = "null" ]; then
        log_error "No previous successful deployment found"
        exit 1
    fi
    
    log_info "Emergency rollback target: $previous_deployment"
    
    # Skip confirmation for emergency rollback
    if perform_rollback "$previous_deployment"; then
        if wait_for_rollback "$previous_deployment"; then
            perform_health_check
        fi
    fi
}

# Interactive rollback selection
interactive_rollback() {
    list_deployments
    
    echo
    read -p "Enter deployment ID to rollback to (or 'auto' for previous successful): " deployment_id
    
    if [ "$deployment_id" = "auto" ]; then
        deployment_id=$(get_previous_deployment)
        if [ -z "$deployment_id" ] || [ "$deployment_id" = "null" ]; then
            log_error "No previous successful deployment found"
            exit 1
        fi
        log_info "Auto-selected deployment: $deployment_id"
    fi
    
    if [ -z "$deployment_id" ]; then
        log_error "No deployment ID provided"
        exit 1
    fi
    
    # Validate deployment ID exists
    if ! jq -e ".[] | select(.id == \"$deployment_id\")" /tmp/deployments.json >/dev/null 2>&1; then
        log_error "Deployment ID not found: $deployment_id"
        exit 1
    fi
    
    if perform_rollback "$deployment_id"; then
        if wait_for_rollback "$deployment_id"; then
            perform_health_check
        fi
    fi
}

# Cleanup
cleanup() {
    rm -f /tmp/deployments.json /tmp/rollback-info.json
}

# Main function
main() {
    local deployment_id="$1"
    
    log_info "Starting rollback for $PROJECT_NAME"
    log_info "Timestamp: $(date)"
    
    # Set trap for cleanup
    trap cleanup EXIT
    
    check_railway_cli
    
    if [ -n "$deployment_id" ]; then
        # Direct rollback to specified deployment
        if perform_rollback "$deployment_id"; then
            if wait_for_rollback "$deployment_id"; then
                perform_health_check
                log_success "🎉 Rollback completed successfully!"
            fi
        fi
    else
        # Interactive rollback
        interactive_rollback
        log_success "🎉 Rollback completed successfully!"
    fi
}

# Script options
case "${1:-}" in
    --help|-h)
        echo "GA4 Analytics MCP Server - Railway Rollback Script"
        echo ""
        echo "Usage: $0 [OPTIONS] [DEPLOYMENT_ID]"
        echo ""
        echo "Options:"
        echo "  --help, -h          Show this help message"
        echo "  --list, -l          List available deployments"
        echo "  --emergency, -e     Emergency rollback to last successful deployment"
        echo "  --current           Show current deployment"
        echo ""
        echo "Arguments:"
        echo "  DEPLOYMENT_ID       Specific deployment ID to rollback to"
        echo ""
        echo "Examples:"
        echo "  $0                  Interactive rollback (shows deployment list)"
        echo "  $0 abc123def        Rollback to specific deployment"
        echo "  $0 --emergency      Emergency rollback to last successful"
        echo "  $0 --list           Just show available deployments"
        echo ""
        exit 0
        ;;
    --list|-l)
        check_railway_cli
        list_deployments
        exit 0
        ;;
    --emergency|-e)
        check_railway_cli
        emergency_rollback
        exit $?
        ;;
    --current)
        check_railway_cli
        current=$(get_current_deployment)
        log_info "Current deployment: $current"
        exit 0
        ;;
    --*)
        log_error "Unknown option: $1"
        log_error "Use --help for usage information"
        exit 1
        ;;
    *)
        # Run main with any provided deployment ID
        main "$1"
        ;;
esac