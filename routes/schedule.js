import express from 'express';
import Schedule from '../models/Schedule.js';
import User from '../models/User.js';
import Bhajan from '../models/Bhajan.js';
import auth from '../middleware/auth.js';
import { sendBhajanEmail } from '../cron/scheduler.js';

const router = express.Router();

// @route GET /api/schedule
// @desc Get user schedules
router.get('/', auth, async (req, res) => {
  try {
    const schedules = await Schedule.find({ user: req.user.id })
      .populate('bhajan', 'title deity pitch')
      .sort({ scheduledDate: 1 });
    res.json(schedules);
  } catch (error) {
    console.error(error.message);
    res.status(500).send('Server Error');
  }
});

// @route POST /api/schedule
// @desc Schedule a bhajan for emailing
router.post('/', auth, async (req, res) => {
  const { bhajanId, scheduledDate } = req.body;

  if (!bhajanId || !scheduledDate) {
    return res.status(400).json({ message: 'Bhajan ID and Date are required' });
  }

  try {
    const bhajanDoc = await Bhajan.findById(bhajanId);
    if (!bhajanDoc) {
      return res.status(404).json({ message: 'Bhajan not found' });
    }
    if (bhajanDoc.user.toString() !== req.user.id) {
      return res.status(401).json({ message: 'User not authorized to schedule this bhajan' });
    }

    const newSchedule = new Schedule({
      user: req.user.id,
      bhajan: bhajanId,
      scheduledDate: new Date(scheduledDate),
      isSent: false
    });

    await newSchedule.save();
    await newSchedule.populate('bhajan', 'title deity pitch');
    
    // Trigger the immediate notification email (isImmediate = true)
    try {
      const userDoc = await User.findById(req.user.id);
      
      if (userDoc && bhajanDoc) {
        await sendBhajanEmail(userDoc, bhajanDoc, true);
        console.log(`Successfully dispatched immediate schedule confirmation to ${userDoc.email}`);
      }
    } catch (emailErr) {
       console.error("Failed to send immediate email, but schedule was saved:", emailErr.message);
    }

    res.status(201).json({ message: 'Bhajan successfully scheduled!', schedule: newSchedule });
  } catch (error) {
    console.error(error.message);
    res.status(500).send('Server Error');
  }
});

// @route PUT /api/schedule/:id
// @desc Update a scheduled date
router.put('/:id', auth, async (req, res) => {
  const { scheduledDate } = req.body;

  if (!scheduledDate) {
    return res.status(400).json({ message: 'Scheduled date is required' });
  }

  try {
    let schedule = await Schedule.findById(req.params.id);

    if (!schedule) {
      return res.status(404).json({ message: 'Schedule not found' });
    }

    if (schedule.user.toString() !== req.user.id) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    schedule.scheduledDate = new Date(scheduledDate);
    schedule.isSent = false;
    await schedule.save();
    await schedule.populate('bhajan', 'title deity pitch');

    res.json(schedule);
  } catch (error) {
    console.error(error.message);
    if (error.kind === 'ObjectId') {
      return res.status(404).json({ message: 'Schedule not found' });
    }
    res.status(500).send('Server Error');
  }
});

// @route DELETE /api/schedule/:id
// @desc Delete schedule
router.delete('/:id', auth, async (req, res) => {
  try {
    const schedule = await Schedule.findById(req.params.id);

    if (!schedule) {
      return res.status(404).json({ message: 'Schedule not found' });
    }

    if (schedule.user.toString() !== req.user.id) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    await Schedule.findByIdAndDelete(req.params.id);
    res.json({ message: 'Schedule removed' });
  } catch (error) {
    console.error(error.message);
    if (error.kind === 'ObjectId') {
      return res.status(404).json({ message: 'Schedule not found' });
    }
    res.status(500).send('Server Error');
  }
});

export default router;
