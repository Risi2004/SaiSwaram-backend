import cron from 'node-cron';
import PDFDocument from 'pdfkit';
import Schedule from '../models/Schedule.js';
import { sendEmail } from '../services/emailService.js';

export default function initializeCronJobs() {
  // Run at 12:00 AM Server Time every day
  // You can debug by making it '* * * * *' to run every minute
  cron.schedule('0 0 * * *', async () => {
    console.log('[CRON] Running daily scheduled bhajan email check...');
    
    try {
      // Find limits for "today"
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date();
      endOfDay.setHours(23, 59, 59, 999);

      const todaysSchedules = await Schedule.find({
        scheduledDate: { $gte: startOfDay, $lte: endOfDay },
        isSent: false
      }).populate('user').populate('bhajan');

      if (todaysSchedules.length === 0) {
        console.log('[CRON] No new schedules found for today.');
        return;
      }

      for (const schedule of todaysSchedules) {
        const { user, bhajan } = schedule;
        
        await sendBhajanEmail(user, bhajan, false);

        // Mark as natively sent so we don't accidentally spam them at 12:01 if chron config fluctuates
        schedule.isSent = true;
        await schedule.save();
        console.log(`[CRON] Successfully completed and emailed ${bhajan.title} to ${user.email}`);
      }

    } catch (error) {
      console.error('[CRON ERROR] Executing daily scheduler failed:', error);
    }
  });
}

export async function sendBhajanEmail(user, bhajan, isImmediate = false) {
  // Generate PDF Buffer synchronously
  const pdfBuffer = await generateBhajanPDFBuffer(bhajan);

  const subject = isImmediate
    ? `Successfully Scheduled: ${bhajan.title}`
    : `Your Scheduled Bhajan: ${bhajan.title}`;
  const htmlContent = `
      <html>
        <body style="font-family: Arial, sans-serif; padding: 20px;">
          <h2 style="color: #C85131;">Om Sri Sai Ram</h2>
          <p>Dear ${user.name},</p>
          ${isImmediate 
             ? `<p>You have successfully scheduled to sing <b>${bhajan.title}</b> (${bhajan.deity}). We will send you another reminder on the day of your session.</p>`
             : `<p>You have scheduled to sing <b>${bhajan.title}</b> (${bhajan.deity}) today.</p>`
          }
          <p>We've attached your requested reading PDF for your convenience so you don't need an internet connection during your session.</p>
          <p>Best,<br/>SaiSwaram Automatic Scheduler</p>
        </body>
      </html>
    `;

  try {
    await sendEmail({
      to: user.email,
      toName: user.name,
      subject,
      htmlContent,
      attachments: [
      {
        content: pdfBuffer.toString('base64'),
        name: `${bhajan.title.replace(/\s+/g, '_')}_SaiSwaram_Sheet.pdf`
      }
      ],
    });
  } catch (err) {
    console.error('[BREVO ERROR] Failed to send email via standard REST API:', err.message);
    throw err;
  }
}

function generateBhajanPDFBuffer(bhajan) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const buffers = [];

      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        resolve(Buffer.concat(buffers));
      });

      // Simple Node-equivalent translation of the visual website layout
      let y = 50;

      // Pitch
      if (bhajan.pitch) {
        doc.fontSize(12).fillColor('#C85131').text(`Pitch: ${bhajan.pitch}`, { align: 'center' });
        y += 20;
      }

      // Title
      doc.fontSize(24).fillColor('#1e1e1e').text(bhajan.title, 50, y, { align: 'center', width: 495 });
      y += 30;

      // Deity
      doc.fontSize(14).fillColor('#969696').text(bhajan.deity, { align: 'center' });
      y += 40;

      // Lyrics
      doc.fontSize(16).fillColor('#323232');
      const lines = bhajan.lyrics.split('\n');

      lines.forEach(line => {
        if (line.trim() === '') {
          doc.moveDown(0.5);
        } else {
          // By allowing default lineBreak (true), pdfkit automatically increments the Y coordinate 
          // downwards gracefully for each subsequent array item so they don't visually collide.
          doc.text(line, { align: 'center' });
          doc.moveDown(0.4); // Add spacing between lines for readability
        }
      });

      // Finalize internal construction memory dump
      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
