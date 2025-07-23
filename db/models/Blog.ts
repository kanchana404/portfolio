import mongoose, { Schema, Document } from 'mongoose';

export interface IBlog extends Document {
  title: string;
  slug: string;
  content: string;
  excerpt: string;
  featuredImage: string;
  generatedImageUrl?: string;
  tags: string[];
  author: string;
  publishedAt: Date;
  isPublished: boolean;
  sourceUrl?: string;
  originalDate?: string;
  createdAt: Date;
  updatedAt: Date;
}

const BlogSchema: Schema = new Schema({
  title: {
    type: String,
    required: [true, 'Title is required'],
    trim: true,
    maxlength: [200, 'Title cannot be more than 200 characters']
  },
  slug: {
    type: String,
    required: [true, 'Slug is required'],
    unique: true,
    trim: true,
    lowercase: true,
    match: [/^[a-z0-9-]+$/, 'Slug can only contain lowercase letters, numbers, and hyphens']
  },
  content: {
    type: String,
    required: [true, 'Content is required'],
    minlength: [100, 'Content must be at least 100 characters']
  },
  excerpt: {
    type: String,
    required: [true, 'Excerpt is required'],
    maxlength: [500, 'Excerpt cannot be more than 500 characters']
  },
  featuredImage: {
    type: String,
    required: [true, 'Featured image is required']
  },
  generatedImageUrl: {
    type: String,
    default: null
  },
  tags: [{
    type: String,
    trim: true,
    lowercase: true
  }],
  author: {
    type: String,
    required: [true, 'Author is required'],
    default: 'Kavitha Kanchan'
  },
  publishedAt: {
    type: Date,
    default: Date.now
  },
  isPublished: {
    type: Boolean,
    default: false
  },
  sourceUrl: {
    type: String,
    default: null
  },
  originalDate: {
    type: String,
    default: null
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Create index for better query performance
BlogSchema.index({ isPublished: 1, publishedAt: -1 });
BlogSchema.index({ tags: 1 });

// Pre-save middleware to generate slug if not provided
BlogSchema.pre('save', function(next) {
  const doc = this as any;
  if (!doc.slug && doc.title) {
    doc.slug = doc.title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  }
  next();
});

// Virtual for formatted date
BlogSchema.virtual('formattedDate').get(function() {
  const doc = this as any;
  if (!doc.publishedAt) {
    return 'Not published';
  }
  return doc.publishedAt.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
});

// Static method to find published blogs
BlogSchema.statics.findPublished = function() {
  return this.find({ isPublished: true }).sort({ publishedAt: -1 });
};

// Static method to find by slug
BlogSchema.statics.findBySlug = function(slug: string) {
  return this.findOne({ slug, isPublished: true });
};

export default mongoose.models.Blog || mongoose.model<IBlog>('Blog', BlogSchema);
