import { supabaseAnonKey, supabaseUrl } from '../lib/supabase';

function loginPageUrl(): string {
  const base = (import.meta.env.VITE_APP_URL as string | undefined)?.replace(/\/$/, '');
  if (base) return `${base}/login`;
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}/login`;
  }
  return '#';
}

export async function sendEmail(
  email: string,
  subject: string,
  html: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${supabaseAnonKey}`,
        apikey: supabaseAnonKey,
      },
      body: JSON.stringify({ email, subject, html }),
    });

    let data: { error?: string; success?: boolean } = {};
    try {
      data = await response.json();
    } catch {
      data = { error: 'Invalid response from email service' };
    }

    if (!response.ok) {
      console.error('Email send failed:', data.error);
      return { success: false, error: data.error || `HTTP ${response.status}` };
    }

    return { success: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Email send error:', error);
    return { success: false, error: message };
  }
}

export function generateStudentCredentialEmail(
  firstName: string,
  loginId: string,
  tempPassword: string,
  role: 'student' | 'teacher' | 'admin'
): { subject: string; html: string } {
  const roleLabel =
    role === 'student' ? 'Student' : role === 'teacher' ? 'Teacher' : 'Administrator';
  const subject = `Welcome to Edulytics PHILTECH - Your ${roleLabel} Account`;
  const loginLabel = role === 'student' ? 'Student ID' : 'Email (login)';
  const href = loginPageUrl();

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: linear-gradient(135deg, #800000 0%, #a52a2a 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
      <h1 style="color: white; margin: 0; font-size: 28px;">Edulytics PHILTECH</h1>
      <p style="color: rgba(255,255,255,0.8); margin: 10px 0 0 0;">Student Performance Analytics System</p>
    </div>

    <div style="background: white; padding: 30px; border-radius: 0 0 12px 12px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
      <h2 style="color: #800000; margin-top: 0;">Welcome, ${firstName}!</h2>
      <p style="color: #333; line-height: 1.6;">Your ${roleLabel} account has been created. Use the credentials below to sign in:</p>

      <div style="background: #f8f8f8; border: 2px solid #800000; border-radius: 8px; padding: 20px; margin: 20px 0;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; color: #666; font-weight: bold;">${loginLabel}:</td>
            <td style="padding: 8px 0; color: #800000; font-weight: bold; font-size: 18px;">${loginId}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #666; font-weight: bold;">Temporary password:</td>
            <td style="padding: 8px 0; color: #800000; font-weight: bold; font-size: 18px; font-family: monospace;">${tempPassword}</td>
          </tr>
        </table>
      </div>

      <p style="color: #b8860b; font-weight: bold; font-size: 14px;">Important: Change your password after you first sign in.</p>

      <div style="text-align: center; margin-top: 25px;">
        <a href="${href}" style="display: inline-block; background: linear-gradient(135deg, #800000 0%, #a52a2a 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 25px; font-weight: bold;">Open login page</a>
      </div>
    </div>

    <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">
      <p>This is an automated message from Edulytics PHILTECH. Please do not reply to this email.</p>
    </div>
  </div>
</body>
</html>
  `.trim();

  return { subject, html };
}

export function generatePasswordResetEmail(
  firstName: string,
  tempPassword: string
): { subject: string; html: string } {
  const subject = 'SAPAS - Password Reset';
  const href = loginPageUrl();

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: linear-gradient(135deg, #800000 0%, #a52a2a 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
      <h1 style="color: white; margin: 0; font-size: 28px;">Edulytics PHILTECH</h1>
      <p style="color: rgba(255,255,255,0.8); margin: 10px 0 0 0;">Password reset</p>
    </div>

    <div style="background: white; padding: 30px; border-radius: 0 0 12px 12px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
      <h2 style="color: #800000; margin-top: 0;">Hello, ${firstName}</h2>
      <p style="color: #333; line-height: 1.6;">Your password was reset. Sign in with this temporary password:</p>

      <div style="background: #f8f8f8; border: 2px solid #d4af37; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center;">
        <p style="color: #666; margin: 0;">Temporary password:</p>
        <p style="color: #800000; font-weight: bold; font-size: 20px; font-family: monospace; margin: 10px 0 0 0;">${tempPassword}</p>
      </div>

      <p style="color: #b8860b; font-weight: bold; font-size: 14px;">Change your password after you sign in.</p>

      <div style="text-align: center; margin-top: 25px;">
        <a href="${href}" style="display: inline-block; background: linear-gradient(135deg, #800000 0%, #a52a2a 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 25px; font-weight: bold;">Open login page</a>
      </div>
    </div>

    <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">
      <p>If you did not request this, contact your administrator.</p>
    </div>
  </div>
</body>
</html>
  `.trim();

  return { subject, html };
}
