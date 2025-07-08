import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const mode = searchParams.get('mode');
  const oobCode = searchParams.get('oobCode');
  const continueUrl = searchParams.get('continueUrl');
  
  // Redirect to the appropriate page based on the action mode
  if (mode === 'resetPassword' && oobCode) {
    // Redirect to a custom password reset page
    return NextResponse.redirect(
      new URL(`/reset-password?oobCode=${oobCode}${continueUrl ? `&continueUrl=${continueUrl}` : ''}`, request.url)
    );
  } else if (mode === 'verifyEmail' && oobCode) {
    // Redirect to email verification page
    return NextResponse.redirect(
      new URL(`/verify-email?oobCode=${oobCode}${continueUrl ? `&continueUrl=${continueUrl}` : ''}`, request.url)
    );
  }
  
  // Default redirect to login if mode is not recognized
  return NextResponse.redirect(new URL('/login', request.url));
}