import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import PendingSignup from '../models/PendingSignup.js';
import PasswordResetOtp from '../models/PasswordResetOtp.js';
import { sendPasswordResetOtpEmail, sendSignupOtpEmail } from '../services/emailService.js';
import {
  canAttemptOtp,
  canResendOtp,
  generateOtpCode,
  getOtpPolicy,
  getResetOtpPolicy,
  hashOtp,
  isOtpExpired,
  otpExpiryDate,
  resetOtpExpiryDate,
} from '../services/otpService.js';

const router = express.Router();

function signTokenForUser(userId) {
  return new Promise((resolve, reject) => {
    jwt.sign(
      { user: { id: userId } },
      process.env.JWT_SECRET || 'secret123',
      { expiresIn: '7d' },
      (err, token) => {
        if (err) reject(err);
        else resolve(token);
      }
    );
  });
}

// @route POST /api/auth/signup/request-otp
// @desc Begin signup by sending OTP email
router.post('/signup/request-otp', async (req, res) => {
  const { name, email, contactNumber, password } = req.body;
  const normalizedEmail = String(email || '').trim().toLowerCase();

  try {
    if (!name || !normalizedEmail || !contactNumber || !password) {
      return res.status(400).json({ message: 'All signup fields are required' });
    }
    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
      return res.status(400).json({ message: 'Please provide a valid email address' });
    }
    if (String(password).length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists with this email' });
    }

    const otpCode = generateOtpCode();
    const policy = getOtpPolicy();
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const pending = await PendingSignup.findOne({ email: normalizedEmail });
    if (pending) {
      const resendGuard = canResendOtp(pending);
      if (!resendGuard.allowed) {
        return res.status(429).json({ message: resendGuard.reason });
      }
    }

    await PendingSignup.findOneAndUpdate(
      { email: normalizedEmail },
      {
        name: String(name).trim(),
        email: normalizedEmail,
        contactNumber: String(contactNumber).trim(),
        passwordHash,
        otpHash: hashOtp(otpCode),
        otpExpiresAt: otpExpiryDate(),
        attemptCount: 0,
        lastOtpSentAt: new Date(),
        resendCount: pending ? pending.resendCount + 1 : 0,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    await sendSignupOtpEmail({
      to: normalizedEmail,
      name: String(name).trim(),
      otpCode,
      expiresInMinutes: policy.expiryMinutes,
    });

    res.json({
      message: 'OTP sent to your email address',
      email: normalizedEmail,
      cooldownSeconds: policy.resendCooldownSeconds,
    });
  } catch (error) {
    console.error('Signup request OTP error:', error.message);
    res.status(500).send('Server Error');
  }
});

// @route POST /api/auth/signup/verify-otp
// @desc Verify OTP and create user account
router.post('/signup/verify-otp', async (req, res) => {
  const { email, otp } = req.body;
  const normalizedEmail = String(email || '').trim().toLowerCase();

  try {
    if (!normalizedEmail || !otp) {
      return res.status(400).json({ message: 'Email and OTP are required' });
    }
    if (!/^\d{6}$/.test(String(otp))) {
      return res.status(400).json({ message: 'OTP must be a 6-digit code' });
    }

    const pending = await PendingSignup.findOne({ email: normalizedEmail });
    if (!pending) {
      return res.status(400).json({ message: 'No pending signup found. Please request OTP again.' });
    }

    if (await User.findOne({ email: normalizedEmail })) {
      await PendingSignup.deleteOne({ _id: pending._id });
      return res.status(400).json({ message: 'User already exists with this email' });
    }

    const attemptGuard = canAttemptOtp(pending);
    if (!attemptGuard.allowed) {
      return res.status(429).json({ message: attemptGuard.reason });
    }

    if (isOtpExpired(pending)) {
      return res.status(400).json({ message: 'OTP expired. Please request a new OTP.' });
    }

    const hashedInput = hashOtp(String(otp));
    if (hashedInput !== pending.otpHash) {
      pending.attemptCount += 1;
      await pending.save();
      return res.status(400).json({ message: 'Invalid OTP. Please try again.' });
    }

    const user = new User({
      name: pending.name,
      email: pending.email,
      contactNumber: pending.contactNumber,
      password: pending.passwordHash,
    });
    await user.save();
    await PendingSignup.deleteOne({ _id: pending._id });

    const token = await signTokenForUser(user.id);
    res.json({ token, message: 'User verified and created successfully' });
  } catch (error) {
    console.error('Signup verify OTP error:', error.message);
    res.status(500).send('Server Error');
  }
});

// @route POST /api/auth/signup/resend-otp
// @desc Resend OTP for pending signup
router.post('/signup/resend-otp', async (req, res) => {
  const { email } = req.body;
  const normalizedEmail = String(email || '').trim().toLowerCase();

  try {
    if (!normalizedEmail) {
      return res.status(400).json({ message: 'Email is required' });
    }

    const pending = await PendingSignup.findOne({ email: normalizedEmail });
    if (!pending) {
      return res.status(400).json({ message: 'No pending signup found. Please start signup again.' });
    }

    const resendGuard = canResendOtp(pending);
    if (!resendGuard.allowed) {
      return res.status(429).json({ message: resendGuard.reason });
    }

    const otpCode = generateOtpCode();
    const policy = getOtpPolicy();
    pending.otpHash = hashOtp(otpCode);
    pending.otpExpiresAt = otpExpiryDate();
    pending.attemptCount = 0;
    pending.resendCount += 1;
    pending.lastOtpSentAt = new Date();
    await pending.save();

    await sendSignupOtpEmail({
      to: pending.email,
      name: pending.name,
      otpCode,
      expiresInMinutes: policy.expiryMinutes,
    });

    res.json({
      message: 'A new OTP has been sent to your email',
      cooldownSeconds: policy.resendCooldownSeconds,
    });
  } catch (error) {
    console.error('Signup resend OTP error:', error.message);
    res.status(500).send('Server Error');
  }
});

// @route POST /api/auth/forgot-password/request-otp
// @desc Request OTP for password reset
router.post('/forgot-password/request-otp', async (req, res) => {
  const { email } = req.body;
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const genericResponse = { message: 'If an account exists, a reset OTP has been sent to that email.' };

  try {
    if (!normalizedEmail || !/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
      return res.status(400).json({ message: 'Please provide a valid email address' });
    }

    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.json(genericResponse);
    }

    const existingReset = await PasswordResetOtp.findOne({ email: normalizedEmail });
    if (existingReset) {
      const resendGuard = canResendOtp(existingReset);
      if (!resendGuard.allowed) {
        return res.json(genericResponse);
      }
    }

    const otpCode = generateOtpCode();
    const policy = getResetOtpPolicy();

    await PasswordResetOtp.findOneAndUpdate(
      { email: normalizedEmail },
      {
        email: normalizedEmail,
        otpHash: hashOtp(otpCode),
        otpExpiresAt: resetOtpExpiryDate(),
        attemptCount: 0,
        resendCount: existingReset ? existingReset.resendCount + 1 : 0,
        lastOtpSentAt: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    await sendPasswordResetOtpEmail({
      to: normalizedEmail,
      name: user.name,
      otpCode,
      expiresInMinutes: policy.expiryMinutes,
    });

    return res.json(genericResponse);
  } catch (error) {
    console.error('Forgot password request OTP error:', error.message);
    return res.status(500).send('Server Error');
  }
});

// @route POST /api/auth/forgot-password/resend-otp
// @desc Resend OTP for password reset
router.post('/forgot-password/resend-otp', async (req, res) => {
  const { email } = req.body;
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const genericResponse = { message: 'If an account exists, a reset OTP has been sent to that email.' };

  try {
    if (!normalizedEmail || !/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
      return res.status(400).json({ message: 'Please provide a valid email address' });
    }

    const user = await User.findOne({ email: normalizedEmail });
    const resetRecord = await PasswordResetOtp.findOne({ email: normalizedEmail });

    if (!user || !resetRecord) {
      return res.json(genericResponse);
    }

    const resendGuard = canResendOtp(resetRecord);
    if (!resendGuard.allowed) {
      return res.status(429).json({ message: resendGuard.reason });
    }

    const otpCode = generateOtpCode();
    const policy = getResetOtpPolicy();
    resetRecord.otpHash = hashOtp(otpCode);
    resetRecord.otpExpiresAt = resetOtpExpiryDate();
    resetRecord.attemptCount = 0;
    resetRecord.resendCount += 1;
    resetRecord.lastOtpSentAt = new Date();
    await resetRecord.save();

    await sendPasswordResetOtpEmail({
      to: normalizedEmail,
      name: user.name,
      otpCode,
      expiresInMinutes: policy.expiryMinutes,
    });

    return res.json({
      ...genericResponse,
      cooldownSeconds: policy.resendCooldownSeconds,
    });
  } catch (error) {
    console.error('Forgot password resend OTP error:', error.message);
    return res.status(500).send('Server Error');
  }
});

// @route POST /api/auth/forgot-password/verify-otp
// @desc Verify reset OTP and update password
router.post('/forgot-password/verify-otp', async (req, res) => {
  const { email, otp, newPassword } = req.body;
  const normalizedEmail = String(email || '').trim().toLowerCase();

  try {
    if (!normalizedEmail || !otp || !newPassword) {
      return res.status(400).json({ message: 'Email, OTP and new password are required' });
    }
    if (!/^\d{6}$/.test(String(otp))) {
      return res.status(400).json({ message: 'OTP must be a 6-digit code' });
    }
    if (String(newPassword).length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    const user = await User.findOne({ email: normalizedEmail });
    const resetRecord = await PasswordResetOtp.findOne({ email: normalizedEmail });
    if (!user || !resetRecord) {
      return res.status(400).json({ message: 'Invalid or expired OTP. Please request a new one.' });
    }

    const attemptGuard = canAttemptOtp(resetRecord);
    if (!attemptGuard.allowed) {
      return res.status(429).json({ message: attemptGuard.reason });
    }

    if (isOtpExpired(resetRecord)) {
      return res.status(400).json({ message: 'OTP expired. Please request a new OTP.' });
    }

    const inputHash = hashOtp(String(otp));
    if (inputHash !== resetRecord.otpHash) {
      resetRecord.attemptCount += 1;
      await resetRecord.save();
      return res.status(400).json({ message: 'Invalid or expired OTP. Please request a new one.' });
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(String(newPassword), salt);
    await user.save();
    await PasswordResetOtp.deleteOne({ _id: resetRecord._id });

    return res.json({ message: 'Password reset successful. You can now log in.' });
  } catch (error) {
    console.error('Forgot password verify OTP error:', error.message);
    return res.status(500).send('Server Error');
  }
});

// @route POST /api/auth/login
// @desc Authenticate user & get token
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    // Check if user exists
    let user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'Invalid Credentials' });
    }

    // Compare passwords
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid Credentials' });
    }

    // Return JWT Payload
    const payload = {
      user: {
        id: user.id
      }
    };

    jwt.sign(
      payload,
      process.env.JWT_SECRET || 'secret123',
      { expiresIn: '7d' },
      (err, token) => {
        if (err) throw err;
        res.json({ token, message: 'Login successful' });
      }
    );
  } catch (error) {
    console.error("Login error:", error.message);
    res.status(500).send('Server Error');
  }
});

export default router;
