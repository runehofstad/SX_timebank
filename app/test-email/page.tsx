'use client';

import { useState } from 'react';

export default function TestEmailPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    success?: boolean;
    message?: string;
    error?: string;
    details?: string | Record<string, unknown>;
    diagnostics?: Record<string, unknown>;
  } | null>(null);

  const handleTest = async () => {
    if (!email) {
      setResult({ error: 'Please enter an email address' });
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const response = await fetch('/api/test-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testEmail: email }),
      });

      const data = await response.json();
      setResult(data);
    } catch (error) {
      setResult({ 
        error: 'Failed to connect to server',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-2xl mx-auto">
        <div className="bg-card rounded-lg shadow-lg border">
          <div className="p-6 border-b">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              📧 Email Configuration Test
            </h1>
            <p className="text-muted-foreground mt-2">
              Test your SMTP email configuration for the Timebank system
            </p>
          </div>
          <div className="p-6 space-y-4">
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium">
                Test Email Address
              </label>
              <div className="flex gap-2">
                <input
                  id="email"
                  type="email"
                  placeholder="your-email@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="flex-1 px-3 py-2 bg-background border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <button 
                  onClick={handleTest} 
                  disabled={loading}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Sending...' : 'Send Test Email'}
                </button>
              </div>
            </div>

            {result && (
              <div className={`p-4 rounded-lg border ${
                result.success 
                  ? 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800' 
                  : 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800'
              }`}>
                <div className="flex items-start gap-2">
                  <span className="text-xl">{result.success ? '✅' : '❌'}</span>
                  <div className="flex-1">
                    <p className={`font-medium ${
                      result.success 
                        ? 'text-green-800 dark:text-green-200' 
                        : 'text-red-800 dark:text-red-200'
                    }`}>
                      {result.success ? result.message : result.error}
                    </p>
                    {result.details && (
                      <div className="mt-2 text-sm">
                        {typeof result.details === 'string' ? (
                          <p className={result.success ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}>
                            {result.details}
                          </p>
                        ) : (
                          <pre className={`whitespace-pre-wrap font-mono text-xs ${
                            result.success ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'
                          }`}>
                            {JSON.stringify(result.details, null, 2)}
                          </pre>
                        )}
                      </div>
                    )}
                    {result.diagnostics && (
                      <div className="mt-3 p-3 bg-background dark:bg-gray-900 rounded border">
                        <p className="font-medium text-sm mb-2">Diagnostics:</p>
                        <dl className="space-y-1 text-sm">
                          <div className="flex gap-2">
                            <dt className="font-medium">Host:</dt>
                            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                            <dd className="text-muted-foreground">{(result.diagnostics as any).host || 'Not set'}</dd>
                          </div>
                          <div className="flex gap-2">
                            <dt className="font-medium">Port:</dt>
                            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                            <dd className="text-muted-foreground">{(result.diagnostics as any).port || 'Not set'}</dd>
                          </div>
                          <div className="flex gap-2">
                            <dt className="font-medium">Username:</dt>
                            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                            <dd className="text-muted-foreground">{(result.diagnostics as any).username || 'Not set'}</dd>
                          </div>
                          <div className="flex gap-2">
                            <dt className="font-medium">From:</dt>
                            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                            <dd className="text-muted-foreground">{(result.diagnostics as any).from || 'Not set'}</dd>
                          </div>
                          <div className="flex gap-2">
                            <dt className="font-medium">Password:</dt>
                            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                            <dd className="text-muted-foreground">{(result.diagnostics as any).hasPassword ? '✓ Set' : '✗ Not set'}</dd>
                          </div>
                        </dl>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="mt-6 p-4 bg-muted dark:bg-gray-800 rounded-lg">
              <h3 className="font-medium text-sm mb-2">Troubleshooting Tips:</h3>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li>• Make sure all environment variables are set in Vercel</li>
                <li>• Try using the full email address as username (e.g., timebank@studiox.tech)</li>
                <li>• Check that the password doesn&apos;t contain special characters that need escaping</li>
                <li>• Verify SPF records are set up for your domain</li>
                <li>• Check Vercel function logs for detailed error messages</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}