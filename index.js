import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.js';
import bhajanRoutes from './routes/bhajans.js';
import scheduleRoutes from './routes/schedule.js';
import analyticsRoutes from './routes/analytics.js';
import initializeCronJobs from './cron/scheduler.js';

dotenv.config();

const app = express();
const rawAllowedOrigins = (process.env.FRONTEND_URL || '').split(',').map((item) => item.trim()).filter(Boolean);

// Middleware
app.use(express.json());
app.use(cors({
  origin(origin, callback) {
    if (!origin) return callback(null, true);

    const isExplicitlyAllowed = rawAllowedOrigins.includes(origin);
    const isLocalhost = /^https?:\/\/localhost(:\d+)?$/i.test(origin);
    const isVercelPreview = /^https:\/\/.+\.vercel\.app$/i.test(origin);

    if (isExplicitlyAllowed || isLocalhost || isVercelPreview) {
      return callback(null, true);
    }

    return callback(new Error('Not allowed by CORS'));
  },
}));
app.use(helmet());

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/bhajans', bhajanRoutes);
app.use('/api/schedule', scheduleRoutes);
app.use('/api/analytics', analyticsRoutes);

const PORT = process.env.PORT || 5000;

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('Connected to MongoDB');
    
    // Initialize scheduled tasks once database is active
    initializeCronJobs();

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Failed to connect to MongoDB', err);
  });