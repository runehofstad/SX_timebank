#!/bin/bash

echo "Enter an alternative email address (e.g., Gmail) to test:"
read -r TEST_EMAIL

if [ -z "$TEST_EMAIL" ]; then
    echo "No email provided. Exiting."
    exit 1
fi

echo "Sending test email to: $TEST_EMAIL"

curl -X POST "https://timebank.studiox.tech/api/test-email" \
  -H "Content-Type: application/json" \
  -d "{\"testEmail\": \"$TEST_EMAIL\"}" \
  -s | python3 -m json.tool

echo ""
echo "Check if the email arrived at $TEST_EMAIL"
echo "Also check SendGrid Activity dashboard"