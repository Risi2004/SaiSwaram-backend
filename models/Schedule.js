import mongoose from 'mongoose';

const ScheduleSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  bhajan: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Bhajan',
    required: true,
  },
  scheduledDate: {
    type: Date,
    required: true,
  },
  isSent: {
    type: Boolean,
    default: false,
  }
}, { timestamps: true });

export default mongoose.model('Schedule', ScheduleSchema);
