import mongoose, { Schema, Document } from 'mongoose';

export interface IUserProfile extends Document {
    uid: string;
    snap_id?: string;
    bitmojiTemplateId?: string;
    cachedPoseUrls?: Record<string, string>;
    snapAccessToken?: string;
    snapRefreshToken?: string;
    snapTokenExpiresAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}

const UserProfileSchema: Schema = new Schema({
    uid: { type: String, required: true, unique: true },
    snap_id: { type: String, unique: true, sparse: true },
    bitmojiTemplateId: { type: String },
    cachedPoseUrls: { type: Map, of: String },
    snapAccessToken: { type: String },
    snapRefreshToken: { type: String },
    snapTokenExpiresAt: { type: Date },
}, {
    timestamps: true,
    collection: 'user_profile'
});

export const UserProfile = mongoose.model<IUserProfile>('UserProfile', UserProfileSchema);
