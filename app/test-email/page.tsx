'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, CheckCircle, Mail, Loader2 } from 'lucide-react';

export default function TestEmailPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    success?: boolean;
    message?: string;
    error?: string;
    details?: any;
    diagnostics?: any;
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
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-6 w-6" />
              Email Configuration Test
            </CardTitle>
            <CardDescription>
              Test your SMTP email configuration for the Timebank system
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium">
                Test Email Address
              </label>
              <div className="flex gap-2">
                <Input
                  id="email"
                  type="email"
                  placeholder="your-email@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="flex-1"
                />
                <Button 
                  onClick={handleTest} 
                  disabled={loading}
                  className="bg-primary hover:bg-primary/90"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    'Send Test Email'
                  )}
                </Button>
              </div>
            </div>

            {result && (
              <div className={`p-4 rounded-lg border ${
                result.success 
                  ? 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800' 
                  : 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800'
              }`}>
                <div className="flex items-start gap-2">
                  {result.success ? (
                    <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5" />
                  )}
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
                          <pre className={`whitespace-pre-wrap ${
                            result.success ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'
                          }`}>
                            {JSON.stringify(result.details, null, 2)}
                          </pre>
                        )}
                      </div>
                    )}
                    {result.diagnostics && (
                      <div className="mt-3 p-3 bg-background rounded border">
                        <p className="font-medium text-sm mb-2">Diagnostics:</p>
                        <dl className="space-y-1 text-sm">
                          <div className="flex gap-2">
                            <dt className="font-medium">Host:</dt>
                            <dd className="text-muted-foreground">{result.diagnostics.host || 'Not set'}</dd>
                          </div>
                          <div className="flex gap-2">
                            <dt className="font-medium">Port:</dt>
                            <dd className="text-muted-foreground">{result.diagnostics.port || 'Not set'}</dd>
                          </div>
                          <div className="flex gap-2">
                            <dt className="font-medium">Username:</dt>
                            <dd className="text-muted-foreground">{result.diagnostics.username || 'Not set'}</dd>
                          </div>
                          <div className="flex gap-2">
                            <dt className="font-medium">From:</dt>
                            <dd className="text-muted-foreground">{result.diagnostics.from || 'Not set'}</dd>
                          </div>
                          <div className="flex gap-2">
                            <dt className="font-medium">Password:</dt>
                            <dd className="text-muted-foreground">{result.diagnostics.hasPassword ? '✓ Set' : '✗ Not set'}</dd>
                          </div>
                        </dl>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="mt-6 p-4 bg-muted rounded-lg">
              <h3 className="font-medium text-sm mb-2">Troubleshooting Tips:</h3>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li>• Make sure all environment variables are set in Vercel</li>
                <li>• Try using the full email address as username (e.g., timebank@studiox.tech)</li>
                <li>• Check that the password doesn't contain special characters that need escaping</li>
                <li>• Verify SPF records are set up for your domain</li>
                <li>• Check Vercel function logs for detailed error messages</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}