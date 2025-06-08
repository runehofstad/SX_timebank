#!/bin/bash

# Load environment variables from .env.production
export $(cat .env.production | grep -v '^#' | xargs)

# Check if email and password are provided
if [ -z "$1" ] || [ -z "$2" ]; then
    echo "Usage: ./create-admin.sh <email> <password> [name]"
    echo "Example: ./create-admin.sh rune@studiox.no YourSecurePassword 'Rune Hofstad'"
    exit 1
fi

# Run the create admin script
node scripts/create-admin.js "$1" "$2" "$3"