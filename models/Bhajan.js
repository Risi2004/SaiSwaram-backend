import mongoose from 'mongoose';

const BhajanSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
  },
  lyrics: {
    type: String,
    required: true,
  },
  pitch: {
    type: String, // E.g. 'C#', 'A'
    default: '',
  },
  deity: {
    type: String,
    required: true,
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true, // Tied to the user who added it
  }
}, { timestamps: true });

export default mongoose.model('Bhajan', BhajanSchema);
