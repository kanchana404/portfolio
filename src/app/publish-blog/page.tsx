'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function PublishBlog() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const publishBlog = async () => {
    setLoading(true);
    setResult(null);

    try {
      const response = await fetch('/api/debug/publish-blog', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();
      setResult(data);
    } catch (error) {
      setResult({ success: false, error: 'Failed to publish blog' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Publish Blog</CardTitle>
          <CardDescription>
            Publish the "AI Innovators Summit" blog to make it visible on the blog page
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button 
            onClick={publishBlog} 
            disabled={loading}
            className="w-full"
          >
            {loading ? 'Publishing...' : 'Publish Blog'}
          </Button>

          {result && (
            <div className={`p-4 rounded-lg ${
              result.success 
                ? 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-200' 
                : 'bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-200'
            }`}>
              <h4 className="font-semibold">
                {result.success ? 'Success!' : 'Error'}
              </h4>
              <p className="text-sm mt-1">
                {result.message || result.error}
              </p>
              {result.success && (
                <div className="mt-2">
                  <p className="text-sm">
                    <strong>Blog:</strong> {result.blog?.title}
                  </p>
                  <p className="text-sm">
                    <strong>Status:</strong> {result.blog?.isPublished ? 'Published' : 'Draft'}
                  </p>
                </div>
              )}
            </div>
          )}

          {result?.success && (
            <div className="mt-4">
              <Button 
                onClick={() => window.location.href = '/blog'} 
                variant="outline"
                className="w-full"
              >
                View Blog Page
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
} 