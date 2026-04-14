import mongoose from 'mongoose';

const PasswordResetOtpSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
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

export default mongoose.model('PasswordResetOtp', PasswordResetOtpSchema);
