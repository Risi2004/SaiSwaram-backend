import crypto from 'crypto';

const OTP_EXPIRY_MINUTES = 10;
const RESET_OTP_EXPIRY_MINUTES = 15;
const OTP_RESEND_COOLDOWN_SECONDS = 60;
const OTP_MAX_ATTEMPTS = 5;
const OTP_MAX_RESENDS = 5;

export function generateOtpCode() {
  const min = 100000;
  const max = 999999;
  return String(Math.floor(Math.random() * (max - min + 1)) + min);
}

export function hashOtp(code) {
  return crypto.createHash('sha256').update(code).digest('hex');
}

export function otpExpiryDate() {
  return new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);
}

export function resetOtpExpiryDate() {
  return new Date(Date.now() + RESET_OTP_EXPIRY_MINUTES * 60 * 1000);
}

export function canResendOtp(pendingSignup) {
  if (pendingSignup.resendCount >= OTP_MAX_RESENDS) {
    return { allowed: false, reason: 'Maximum resend limit reached. Please restart signup.' };
  }

  const elapsedSeconds = Math.floor((Date.now() - new Date(pendingSignup.lastOtpSentAt).getTime()) / 1000);
  if (elapsedSeconds < OTP_RESEND_COOLDOWN_SECONDS) {
    return {
      allowed: false,
      reason: `Please wait ${OTP_RESEND_COOLDOWN_SECONDS - elapsedSeconds}s before requesting another OTP.`,
    };
  }

  return { allowed: true, reason: null };
}

export function canAttemptOtp(pendingSignup) {
  if (pendingSignup.attemptCount >= OTP_MAX_ATTEMPTS) {
    return { allowed: false, reason: 'Too many invalid OTP attempts. Please request a new OTP.' };
  }
  return { allowed: true, reason: null };
}

export function isOtpExpired(pendingSignup) {
  return new Date(pendingSignup.otpExpiresAt).getTime() < Date.now();
}

export function getOtpPolicy() {
  return {
    expiryMinutes: OTP_EXPIRY_MINUTES,
    resendCooldownSeconds: OTP_RESEND_COOLDOWN_SECONDS,
    maxAttempts: OTP_MAX_ATTEMPTS,
    maxResends: OTP_MAX_RESENDS,
  };
}

export function getResetOtpPolicy() {
  return {
    expiryMinutes: RESET_OTP_EXPIRY_MINUTES,
    resendCooldownSeconds: OTP_RESEND_COOLDOWN_SECONDS,
    maxAttempts: OTP_MAX_ATTEMPTS,
    maxResends: OTP_MAX_RESENDS,
  };
}
