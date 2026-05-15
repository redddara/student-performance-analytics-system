declare module '../api/email' {
  export function sendEmail(email: string, subject: string, html: string): Promise<{ success: boolean; error?: string }>;
  export function generateStudentCredentialEmail(firstName: string, loginId: string, tempPassword: string, role: 'student' | 'teacher' | 'admin'): { subject: string; html: string };
  export function generatePasswordResetOtpEmail(
    firstName: string,
    otp: string,
    expiresInMinutes: number
  ): { subject: string; html: string };
  export function generatePasswordResetEmail(firstName: string, tempPassword: string): { subject: string; html: string };
}

