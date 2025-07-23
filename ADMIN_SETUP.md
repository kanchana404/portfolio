# Admin Blog Management Setup

This guide will help you set up the admin blog management system with image generation capabilities.

## Environment Variables

Create a `.env.local` file in your project root with the following variables:

```env
# MongoDB Connection
MONGODB_URI=mongodb://localhost:27017/your-database-name

# Admin Authentication
ADMIN_PASSWORD=your-secure-admin-password

# Ideogram API for Image Generation
IDEOGRAM_API_KEY=your-ideogram-api-key

# OpenAI API for Content Optimization
OPENAI_API_KEY=your-openai-api-key

# Next.js
NEXTAUTH_SECRET=your-nextauth-secret
NEXTAUTH_URL=http://localhost:3000
```

## Setup Instructions

### 1. MongoDB Setup
- Ensure MongoDB is running on your system
- Update the `MONGODB_URI` with your database connection string

### 2. Admin Password
- Set a secure password in `ADMIN_PASSWORD`
- This will be used to access the admin dashboard at `/admin`

### 3. Ideogram API Setup
- Sign up at [Ideogram](https://ideogram.ai/)
- Get your API key from the dashboard
- Add it to `IDEOGRAM_API_KEY`

### 4. OpenAI API Setup
- Sign up at [OpenAI](https://platform.openai.com/)
- Get your API key from the dashboard
- Add it to `OPENAI_API_KEY`

### 5. Install Dependencies
```bash
npm install
```

### 6. Run the Development Server
```bash
npm run dev
```

## Usage

### Accessing Admin Dashboard
1. Navigate to `/admin/login`
2. Enter the admin password you set in `ADMIN_PASSWORD`
3. You'll be redirected to the admin dashboard

### Creating Blogs
1. Click "Create New Blog" in the admin dashboard
2. Fill in the blog details:
   - Title (required)
   - Excerpt (required, max 300 characters)
   - Content (required)
   - Tags (comma-separated)
   - Featured Image (can be generated or custom URL)

### Generating Images
1. In the blog creation form, enter a description of the image you want
2. Click the "Generate Image" button
3. The AI will create an image based on your prompt
4. You can also use the "Auto-generate prompt" button to create a prompt based on your blog title

### Optimizing Content
1. Write your blog content in the content field
2. Use the optimization buttons:
   - **Optimize**: General content improvement for readability and engagement
   - **SEO**: Optimize for search engine optimization
   - **Technical**: Improve technical content clarity and accuracy
3. The AI will enhance your content while maintaining your original message

### Managing Blogs
- View all blogs in the admin dashboard
- Edit existing blogs (coming soon)
- Delete blogs with confirmation
- Toggle between published and draft status

## Features

- ✅ Password-protected admin access
- ✅ Blog creation with rich text content
- ✅ AI-powered image generation using Ideogram
- ✅ AI-powered content optimization using OpenAI
- ✅ Tag management
- ✅ Draft/Published status
- ✅ Responsive design
- ✅ Dark mode support

## Security Notes

- The admin password is stored in environment variables
- Admin sessions are managed via HTTP-only cookies
- All admin routes are protected by middleware
- Image generation API calls are rate-limited by Ideogram

## Troubleshooting

### Image Generation Issues
- Ensure your Ideogram API key is valid
- Check that you have sufficient credits in your Ideogram account
- Verify the API endpoint is accessible

### Database Issues
- Check MongoDB connection string
- Ensure MongoDB service is running
- Verify database permissions

### Admin Access Issues
- Clear browser cookies if login problems persist
- Check that `ADMIN_PASSWORD` is set correctly
- Restart the development server after changing environment variables 