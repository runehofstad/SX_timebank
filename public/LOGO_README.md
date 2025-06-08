# Logo Files Required

To display the Timebank logo on the login and register pages, you need to add the following files to this directory:

1. **timebank-logo-light.png** - Logo for light mode (should have dark/colored elements that show well on light backgrounds)
2. **timebank-logo-dark.png** - Logo for dark mode (should have light/white elements that show well on dark backgrounds)

## Specifications:
- Format: PNG with transparent background
- Recommended size: Height of approximately 64px (width can vary to maintain aspect ratio)
- The logo will be displayed at 64px height (h-16 in Tailwind CSS)

## How it works:
- The light logo (`timebank-logo-light.png`) will be shown when the user is in light mode
- The dark logo (`timebank-logo-dark.png`) will be shown when the user is in dark mode
- The switch happens automatically based on the user's theme preference

Place both logo files in this `/public` directory.