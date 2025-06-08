#!/bin/bash

echo "Testing invitation email..."

curl -X POST "https://timebank.studiox.tech/api/invite" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "rune@studiox.no",
    "name": "Rune Hofstad",
    "role": "admin",
    "token": "test-'$(date +%s)'",
    "inviterName": "Timebank System"
  }' \
  -v

echo ""
echo "Check SendGrid Activity to see if this email was sent."