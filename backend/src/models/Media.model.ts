import mongoose, { Schema, Document } from 'mongoose';

export interface IMedia extends Document {
  userId: string;
  dateNightId?: string;
  reviewId?: string;
  // Moment-specific fields
  momentDate?: string; // YYYY-MM-DD format
  pairId?: string; // Couple identifier for moments
  caption?: string; // Optional caption for moments
  type: 'image' | 'video';
  url: string;
  filename: string;
  size: number;
  contentType: string;
  createdAt: Date;
  updatedAt: Date;
}

const MediaSchema = new Schema<IMedia>(
  {
    userId: { type: String, required: true, index: true },
    dateNightId: { type: String, index: true },
    reviewId: { type: String, index: true },
    // Moment-specific fields
    momentDate: { type: String, index: true }, // Index for quick date lookups
    pairId: { type: String, index: true }, // Index for couple queries
    caption: { type: String },
    type: { type: String, enum: ['image', 'video'], required: true },
    url: { type: String, required: true },
    filename: { type: String, required: true },
    size: { type: Number, required: true },
    contentType: { type: String, required: true },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model<IMedia>('Media', MediaSchema);

