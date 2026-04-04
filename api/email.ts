const SUPABASE_URL = 'https://xlmlrplyfizfhklhaicc.supabase.co';

// Send email via Edge Function
export async function sendEmail(email: string, subject: string, html: string): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, subject, html }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Email send failed:', data.error);
      return { success: false, error: data.error };
    }

    return { success: true };
  } catch (error: any) {
    console.error('Email send error:', error);
    return { success: false, error: error.message };
  }
}

// Generate email HTML for new student credentials
export function generateStudentCredentialEmail(
  firstName: string,
  username: string,
  tempPassword: string,
  role: 'student' | 'teacher'
): { subject: string; html: string } {
  const roleLabel = role === 'student' ? 'Student' : 'Teacher';
  const subject = `Welcome to SAPAS - Your ${roleLabel} Account`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #800000 0%, #a52a2a 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
      <h1 style="color: white; margin: 0; font-size: 28px;"><i className="hgi-stroke hgi-mortarboard-01"></i> SAPAS</h1>
      <p style="color: rgba(255,255,255,0.8); margin: 10px 0 0 0;">Student Academic Performance Analytics System</p>
    </div>
    
    <!-- Content -->
    <div style="background: white; padding: 30px; border-radius: 0 0 12px 12px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
      <h2 style="color: #800000; margin-top: 0;">Welcome, ${firstName}!</h2>
      <p style="color: #333; line-height: 1.6;">Your ${roleLabel} account has been created successfully. Here are your login credentials:</p>
      
      <!-- Credentials Box -->
      <div style="background: #f8f8f8; border: 2px solid #800000; border-radius: 8px; padding: 20px; margin: 20px 0;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; color: #666; font-weight: bold;">Username:</td>
            <td style="padding: 8px 0; color: #800000; font-weight: bold; font-size: 18px;">${username}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #666; font-weight: bold;">Temporary Password:</td>
            <td style="padding: 8px 0; color: #800000; font-weight: bold; font-size: 18px; font-family: monospace;">${tempPassword}</td>
          </tr>
        </table>
      </div>
      
      <p style="color: #d4af37; font-weight: bold; font-size: 14px;"><i className="hgi-stroke hgi-warning-02"></i> Important: Please change your password upon first login.</p>
      
      <p style="color: #666; font-size: 14px;">You can now log in to the system using your credentials.</p>
      
      <div style="text-align: center; margin-top: 25px;">
        <a href="#" style="display: inline-block; background: linear-gradient(135deg, #800000 0%, #a52a2a 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 25px; font-weight: bold;">Login to System</a>
      </div>
    </div>
    
    <!-- Footer -->
    <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">
      <p>This is an automated message from SAPAS. Please do not reply to this email.</p>
    </div>
  </div>
</body>
</html>
  `.trim();

  return { subject, html };
}

// Send password reset email
export function generatePasswordResetEmail(firstName: string, tempPassword: string): { subject: string; html: string } {
  const subject = 'SAPAS - Password Reset';

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #800000 0%, #a52a2a 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
      <h1 style="color: white; margin: 0; font-size: 28px;"><i className="hgi-stroke hgi-mortarboard-01"></i> SAPAS</h1>
      <p style="color: rgba(255,255,255,0.8); margin: 10px 0 0 0;">Password Reset</p>
    </div>
    
    <!-- Content -->
    <div style="background: white; padding: 30px; border-radius: 0 0 12px 12px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
      <h2 style="color: #800000; margin-top: 0;">Password Reset, ${firstName}!</h2>
      <p style="color: #333; line-height: 1.6;">Your password has been reset. Here is your new temporary password:</p>
      
      <!-- Credentials Box -->
      <div style="background: #f8f8f8; border: 2px solid #d4af37; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center;">
        <p style="color: #666; margin: 0;">Temporary Password:</p>
        <p style="color: #800000; font-weight: bold; font-size: 20px; font-family: monospace; margin: 10px 0 0 0;">${tempPassword}</p>
      </div>
      
      <p style="color: #d4af37; font-weight: bold; font-size: 14px;"><i className="hgi-stroke hgi-warning-02"></i> Important: Please change your password upon login.</p>
    </div>
    
    <!-- Footer -->
    <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">
      <p>If you did not request this, please contact your administrator.</p>
    </div>
  </div>
</body>
</html>
  `.trim();

  return { subject, html };
}