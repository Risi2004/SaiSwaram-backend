import mongoose from 'mongoose';

const PendingSignupSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
  },
  contactNumber: {
    type: String,
    required: true,
  },
  passwordHash: {
    type: String,
    required: true,
  },
  otpHash: {
    type: String,
    required: true,
  },
  otpExpiresAt: {
    type: Date,
    required: true,
  },
  attemptCount: {
    type: Number,
    default: 0,
  },
  resendCount: {
    type: Number,
    default: 0,
  },
  lastOtpSentAt: {
    type: Date,
    required: true,
  },
  expiresAt: {
    type: Date,
    required: true,
    default: () => new Date(Date.now() + 24 * 60 * 60 * 1000),
    index: { expires: 0 },
  },
}, { timestamps: true });

export default mongoose.model('PendingSignup', PendingSignupSchema);
