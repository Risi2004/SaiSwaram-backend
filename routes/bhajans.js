import express from 'express';
import Bhajan from '../models/Bhajan.js';
import auth from '../middleware/auth.js';

const router = express.Router();

// @route GET /api/bhajans
// @desc Get all user bhajans
router.get('/', auth, async (req, res) => {
  try {
    const bhajans = await Bhajan.find({ user: req.user.id }).sort({ title: 1 });
    res.json(bhajans);
  } catch (error) {
    console.error(error.message);
    res.status(500).send('Server Error');
  }
});

// @route POST /api/bhajans
// @desc Add new bhajan
router.post('/', auth, async (req, res) => {
  const { title, lyrics, pitch, deity } = req.body;

  try {
    const newBhajan = new Bhajan({
      title,
      lyrics,
      pitch,
      deity,
      user: req.user.id
    });

    const savedBhajan = await newBhajan.save();
    res.status(201).json(savedBhajan);
  } catch (error) {
    console.error(error.message);
    res.status(500).send('Server Error');
  }
});

// @route GET /api/bhajans/:id
// @desc Get bhajan by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const bhajan = await Bhajan.findById(req.params.id);

    if (!bhajan) {
      return res.status(404).json({ message: 'Bhajan not found' });
    }

    // Ensure the user trying to read it actually owns it
    if (bhajan.user.toString() !== req.user.id) {
      return res.status(401).json({ message: 'User not authorized' });
    }

    res.json(bhajan);
  } catch (error) {
    console.error(error.message);
    // If the ID is completely invalid format, Mongoose throws CastError
    if (error.kind === 'ObjectId') {
      return res.status(404).json({ message: 'Bhajan not found' });
    }
    res.status(500).send('Server Error');
  }
});

// @route PUT /api/bhajans/:id
// @desc Update a bhajan
router.put('/:id', auth, async (req, res) => {
  const { title, lyrics, pitch, deity } = req.body;

  // Build bhajan object
  const bhajanFields = {};
  if (title) bhajanFields.title = title;
  if (lyrics) bhajanFields.lyrics = lyrics;
  if (pitch !== undefined) bhajanFields.pitch = pitch;
  if (deity) bhajanFields.deity = deity;

  try {
    let bhajan = await Bhajan.findById(req.params.id);

    if (!bhajan) return res.status(404).json({ message: 'Bhajan not found' });

    // Make sure user owns bhajan
    if (bhajan.user.toString() !== req.user.id) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    bhajan = await Bhajan.findByIdAndUpdate(
      req.params.id,
      { $set: bhajanFields },
      { new: true }
    );

    res.json(bhajan);
  } catch (error) {
    console.error(error.message);
    res.status(500).send('Server Error');
  }
});

// @route DELETE /api/bhajans/:id
// @desc Delete a bhajan
router.delete('/:id', auth, async (req, res) => {
  try {
    let bhajan = await Bhajan.findById(req.params.id);

    if (!bhajan) return res.status(404).json({ message: 'Bhajan not found' });

    // Make sure user owns bhajan
    if (bhajan.user.toString() !== req.user.id) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    await Bhajan.findByIdAndDelete(req.params.id);

    res.json({ message: 'Bhajan removed' });
  } catch (error) {
    console.error(error.message);
    res.status(500).send('Server Error');
  }
});

export default router;
