import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    environment: {
      NODE_ENV: process.env.NODE_ENV,
      EMAIL_HOST: process.env.EMAIL_HOST,
      EMAIL_PORT: process.env.EMAIL_PORT,
      EMAIL_USER: process.env.EMAIL_USER ? '✓ Set' : '✗ Missing',
      EMAIL_PASSWORD: process.env.EMAIL_PASSWORD ? '✓ Set' : '✗ Missing',
      EMAIL_FROM: process.env.EMAIL_FROM,
      NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    },
    sendgrid: {
      isConfigured: process.env.EMAIL_HOST === 'smtp.sendgrid.net',
      username: process.env.EMAIL_USER === 'apikey' ? '✓ Correct' : '✗ Should be "apikey"',
    },
    timestamp: new Date().toISOString(),
  });
}