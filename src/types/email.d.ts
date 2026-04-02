declare module '../api/email' {
  export function sendEmail(email: string, subject: string, html: string): Promise<{ success: boolean; error?: string }>;
  export function generateStudentCredentialEmail(firstName: string, username: string, tempPassword: string, role: 'student' | 'teacher'): { subject: string; html: string };
  export function generatePasswordResetEmail(firstName: string, tempPassword: string): { subject: string; html: string };
}

