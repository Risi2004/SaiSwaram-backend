import express from 'express';
import mongoose from 'mongoose';
import Schedule from '../models/Schedule.js';
import auth from '../middleware/auth.js';

const router = express.Router();

router.get('/', auth, async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(String(req.user.id));

    // 1. Total Scheduled Counts
    const totalScheduled = await Schedule.countDocuments({ user: userId });

    // 2. Deity Distribution (Lookup to Bhajan collection)
    const deityDistribution = await Schedule.aggregate([
      { $match: { user: userId } },
      {
        $lookup: {
          from: 'bhajans', 
          localField: 'bhajan',
          foreignField: '_id',
          as: 'bhajanDetails'
        }
      },
      { $unwind: '$bhajanDetails' },
      {
        $group: {
          _id: '$bhajanDetails.deity',
          count: { $sum: 1 }
        }
      },
      {
        $project: {
          name: { $cond: { if: { $eq: ['$_id', ''] }, then: 'Other', else: '$_id' } },
          value: '$count',
          _id: 0
        }
      },
      { $sort: { value: -1 } },
      { $limit: 6 } // Top 6 deities for cleaner pie charts
    ]);

    // 3. Monthly Trends
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    
    const monthlyDataRaw = await Schedule.aggregate([
      { $match: { user: userId } },
      {
        $group: {
          _id: { $month: "$scheduledDate" },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    const monthlyTrends = monthlyDataRaw.map(item => ({
      name: monthNames[item._id - 1],
      sessions: item.count
    }));

    res.json({
      totalScheduled,
      deityDistribution,
      monthlyTrends
    });

  } catch (err) {
    console.error('Analytics Fetch Error:', err);
    res.status(500).json({ message: 'Failed to fetch analytics' });
  }
});

export default router;
