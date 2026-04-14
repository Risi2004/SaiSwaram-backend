export async function sendEmail({ to, toName, subject, htmlContent, attachments = [] }) {
  if (!process.env.BREVO_API_KEY) {
    console.warn('[WARNING] BREVO_API_KEY is not defined in .env. Skipping email dispatch.');
    return;
  }

  const payload = {
    sender: {
      name: 'SaiSwaram Dashboard',
      email: process.env.BREVO_SENDER_EMAIL || 'noreply@saiswaram.com',
    },
    to: [{ email: to, name: toName || to }],
    subject,
    htmlContent,
    attachment: attachments,
  };

  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'api-key': process.env.BREVO_API_KEY,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(JSON.stringify(errorData));
  }
}

export async function sendSignupOtpEmail({ to, name, otpCode, expiresInMinutes }) {
  await sendEmail({
    to,
    toName: name,
    subject: 'Verify your SaiSwaram signup OTP',
    htmlContent: `
      <html>
        <body style="font-family: Arial, sans-serif; padding: 20px;">
          <h2 style="color: #C85131;">SaiSwaram Signup Verification</h2>
          <p>Dear ${name},</p>
          <p>Your one-time verification code is:</p>
          <p style="font-size: 28px; font-weight: bold; letter-spacing: 4px; color: #1f2937;">${otpCode}</p>
          <p>This OTP expires in ${expiresInMinutes} minutes.</p>
          <p>If you did not request this signup, you can ignore this email.</p>
          <p>Best,<br/>SaiSwaram Team</p>
        </body>
      </html>
    `,
  });
}

export async function sendPasswordResetOtpEmail({ to, name, otpCode, expiresInMinutes }) {
  await sendEmail({
    to,
    toName: name || to,
    subject: 'SaiSwaram password reset OTP',
    htmlContent: `
      <html>
        <body style="font-family: Arial, sans-serif; padding: 20px;">
          <h2 style="color: #C85131;">SaiSwaram Password Reset</h2>
          <p>Dear ${name || 'User'},</p>
          <p>Use this one-time code to reset your password:</p>
          <p style="font-size: 28px; font-weight: bold; letter-spacing: 4px; color: #1f2937;">${otpCode}</p>
          <p>This OTP expires in ${expiresInMinutes} minutes.</p>
          <p>If you did not request this password reset, please ignore this email.</p>
          <p>Best,<br/>SaiSwaram Team</p>
        </body>
      </html>
    `,
  });
}
