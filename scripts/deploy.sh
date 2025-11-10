#!/bin/bash

# deploy.sh - Simple wrapper for ALB node deployment
# Usage: ./deploy.sh [environment]
# Example: ./deploy.sh dev

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Run the deployment script
"$SCRIPT_DIR/deploy-to-alb-nodes.sh" "$@"
