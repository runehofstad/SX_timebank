#!/bin/bash

# Test with a Gmail address or other provider
echo "Testing email to different domain..."
echo "Please replace 'your-email@gmail.com' with a real email address you control"
echo ""

# Example test - you need to edit this with a real email
TEST_EMAIL="your-email@gmail.com"

echo "IMPORTANT: Edit this script and replace $TEST_EMAIL with your Gmail or other email"
echo "Then run it again to test if emails work to other domains"

# Uncomment and edit the line below with a real email address:
# curl -X POST "https://timebank.studiox.tech/api/test-email" \
#   -H "Content-Type: application/json" \
#   -d '{"testEmail": "YOUR-REAL-EMAIL@gmail.com"}' \
#   -s | python3 -m json.tool