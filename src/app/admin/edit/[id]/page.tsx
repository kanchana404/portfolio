'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Wand2, Image, Save, ArrowLeft, Loader2, Sparkles, Eye } from 'lucide-react';
import Link from 'next/link';

interface Blog {
  _id: string;
  title: string;
  slug: string;
  content: string;
  excerpt: string;
  featuredImage: string;
  generatedImageUrl?: string;
  tags: string[];
  author: string;
  isPublished: boolean;
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export default function EditBlog() {
  const router = useRouter();
  const params = useParams();
  const blogId = params.id as string;

  const [blog, setBlog] = useState<Blog | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    excerpt: '',
    featuredImage: '',
    tags: '',
    isPublished: false
  });
  const [generatedImageUrl, setGeneratedImageUrl] = useState('');
  const [imagePrompt, setImagePrompt] = useState('');
  const [generatingImage, setGeneratingImage] = useState(false);
  const [optimizingContent, setOptimizingContent] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchBlog();
  }, [blogId]);

  const fetchBlog = async () => {
    try {
      const response = await fetch(`/api/admin/blogs/${blogId}`);
      if (response.ok) {
        const data = await response.json();
        setBlog(data.blog);
        setFormData({
          title: data.blog.title,
          content: data.blog.content,
          excerpt: data.blog.excerpt,
          featuredImage: data.blog.featuredImage,
          tags: data.blog.tags.join(', '),
          isPublished: data.blog.isPublished
        });
        if (data.blog.generatedImageUrl) {
          setGeneratedImageUrl(data.blog.generatedImageUrl);
        }
      } else {
        setError('Blog not found');
      }
    } catch (error) {
      console.error('Error fetching blog:', error);
      setError('Error loading blog');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }));
  };

  const generateImage = async () => {
    if (!imagePrompt.trim()) {
      setError('Please enter an image prompt');
      return;
    }

    setGeneratingImage(true);
    setError('');

    try {
      const response = await fetch('/api/admin/generate-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: imagePrompt,
          aspectRatio: '16x9'
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setGeneratedImageUrl(data.imageUrl);
        setFormData(prev => ({ ...prev, featuredImage: data.imageUrl }));
      } else {
        setError(data.error || 'Failed to generate image');
      }
    } catch (error) {
      console.error('Image generation error:', error);
      setError('Error generating image');
    } finally {
      setGeneratingImage(false);
    }
  };

  const optimizeContent = async (type: 'general' | 'technical' | 'seo' = 'general') => {
    if (!formData.content.trim()) {
      setError('Please enter some content to optimize');
      return;
    }

    setOptimizingContent(true);
    setError('');

    try {
      const response = await fetch('/api/admin/optimize-content', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: formData.content,
          type
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setFormData(prev => ({ ...prev, content: data.optimizedContent }));
      } else {
        setError(data.error || 'Failed to optimize content');
      }
    } catch (error) {
      console.error('Content optimization error:', error);
      setError('Error optimizing content');
    } finally {
      setOptimizingContent(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    try {
      const tagsArray = formData.tags
        .split(',')
        .map(tag => tag.trim())
        .filter(tag => tag.length > 0);

      const blogData = {
        ...formData,
        tags: tagsArray,
        generatedImageUrl: generatedImageUrl || undefined
      };

      const response = await fetch(`/api/admin/blogs/${blogId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(blogData),
      });

      const data = await response.json();

      if (response.ok) {
        router.push('/admin');
      } else {
        setError(data.error || 'Failed to update blog');
      }
    } catch (error) {
      console.error('Blog update error:', error);
      setError('Error updating blog');
    } finally {
      setSaving(false);
    }
  };

  const generateImagePrompt = () => {
    if (!formData.title) {
      setError('Please enter a title first to generate an image prompt');
      return;
    }

    const prompt = `A modern, professional blog header image for "${formData.title}". Clean design with subtle gradients, minimal text overlay, suitable for a tech/development blog. High quality, 16:9 aspect ratio, professional photography style.`;
    setImagePrompt(prompt);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading blog...</div>
      </div>
    );
  }

  if (error && !blog) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-lg text-red-600 mb-4">{error}</div>
          <Link href="/admin">
            <Button>Back to Dashboard</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <Link href="/admin" className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Link>
        </div>

        <Card className="max-w-4xl mx-auto">
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>Edit Blog Post</CardTitle>
                <CardDescription>
                  Update your blog post with AI-powered enhancements
                </CardDescription>
              </div>
              {blog && (
                <Link href={`/blog/${blog.slug}`}>
                  <Button variant="outline" size="sm">
                    <Eye className="w-4 h-4 mr-2" />
                    View Blog
                  </Button>
                </Link>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="title">Title *</Label>
                    <Input
                      id="title"
                      name="title"
                      value={formData.title}
                      onChange={handleInputChange}
                      placeholder="Enter blog title"
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="excerpt">Excerpt *</Label>
                    <Textarea
                      id="excerpt"
                      name="excerpt"
                      value={formData.excerpt}
                      onChange={handleInputChange}
                      placeholder="Brief description of the blog post"
                      rows={3}
                      maxLength={300}
                      required
                    />
                    <p className="text-sm text-gray-500 mt-1">
                      {formData.excerpt.length}/300 characters
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="tags">Tags</Label>
                    <Input
                      id="tags"
                      name="tags"
                      value={formData.tags}
                      onChange={handleInputChange}
                      placeholder="tag1, tag2, tag3"
                    />
                    <p className="text-sm text-gray-500 mt-1">
                      Separate tags with commas
                    </p>
                  </div>

                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="isPublished"
                      name="isPublished"
                      checked={formData.isPublished}
                      onChange={handleInputChange}
                      className="rounded"
                      aria-label="Publish immediately"
                    />
                    <Label htmlFor="isPublished">Publish immediately</Label>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <Label>Featured Image</Label>
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <Input
                          value={imagePrompt}
                          onChange={(e) => setImagePrompt(e.target.value)}
                          placeholder="Describe the image you want to generate"
                        />
                        <Button
                          type="button"
                          onClick={generateImagePrompt}
                          variant="outline"
                          size="sm"
                        >
                          <Wand2 className="w-4 h-4" />
                        </Button>
                      </div>
                      <Button
                        type="button"
                        onClick={generateImage}
                        disabled={generatingImage || !imagePrompt}
                        className="w-full"
                      >
                        {generatingImage ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Generating...
                          </>
                        ) : (
                          <>
                            <Image className="w-4 h-4 mr-2" />
                            Generate Image
                          </>
                        )}
                      </Button>
                    </div>
                  </div>

                  {generatedImageUrl && (
                    <div>
                      <Label>Generated Image</Label>
                      <div className="mt-2">
                        <img
                          src={generatedImageUrl}
                          alt="Generated featured image"
                          className="w-full h-48 object-cover rounded-lg border"
                        />
                      </div>
                    </div>
                  )}

                  <div>
                    <Label htmlFor="featuredImage">Or use custom image URL</Label>
                    <Input
                      id="featuredImage"
                      name="featuredImage"
                      value={formData.featuredImage}
                      onChange={handleInputChange}
                      placeholder="https://example.com/image.jpg"
                    />
                  </div>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <Label htmlFor="content">Content *</Label>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      onClick={() => optimizeContent('general')}
                      disabled={optimizingContent || !formData.content.trim()}
                      variant="outline"
                      size="sm"
                    >
                      {optimizingContent ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Optimizing...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4 mr-2" />
                          Optimize
                        </>
                      )}
                    </Button>
                    <Button
                      type="button"
                      onClick={() => optimizeContent('seo')}
                      disabled={optimizingContent || !formData.content.trim()}
                      variant="outline"
                      size="sm"
                    >
                      SEO
                    </Button>
                    <Button
                      type="button"
                      onClick={() => optimizeContent('technical')}
                      disabled={optimizingContent || !formData.content.trim()}
                      variant="outline"
                      size="sm"
                    >
                      Technical
                    </Button>
                  </div>
                </div>
                <Textarea
                  id="content"
                  name="content"
                  value={formData.content}
                  onChange={handleInputChange}
                  placeholder="Write your blog content here..."
                  rows={12}
                  required
                />
                <p className="text-sm text-gray-500 mt-1">
                  {formData.content.length} characters
                </p>
              </div>

              {error && (
                <div className="text-red-500 text-sm">{error}</div>
              )}

              <div className="flex justify-end gap-4">
                <Link href="/admin">
                  <Button type="button" variant="outline">
                    Cancel
                  </Button>
                </Link>
                <Button type="submit" disabled={saving}>
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Update Blog
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 