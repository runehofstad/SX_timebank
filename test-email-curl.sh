#!/bin/bash

# Test email configuration using curl
# Usage: ./test-email-curl.sh your-email@example.com

if [ -z "$1" ]; then
    echo "Usage: ./test-email-curl.sh your-email@example.com"
    exit 1
fi

EMAIL="$1"
URL="https://timebank-system.vercel.app/api/test-email"

echo "Testing email configuration..."
echo "Sending test email to: $EMAIL"
echo ""

curl -X POST "$URL" \
  -H "Content-Type: application/json" \
  -d "{\"testEmail\": \"$EMAIL\"}" \
  -v

echo ""
echo "Check the response above for success or error details."