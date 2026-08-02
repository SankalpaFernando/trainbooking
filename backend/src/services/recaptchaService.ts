export class RecaptchaService {
  private static readonly SECRET_KEY = process.env.RECAPTCHA_SECRET_KEY || '';
  private static readonly VERIFY_URL = 'https://www.google.com/recaptcha/api/siteverify';

  public static async verifyToken(token: string, remoteIp?: string) {
    if (!this.SECRET_KEY) {
      throw new Error('Recaptcha secret key is not configured');
    }

    const params = new URLSearchParams({
      secret: this.SECRET_KEY,
      response: token,
    });

    if (remoteIp) {
      params.append('remoteip', remoteIp);
    }

    const response = await fetch(this.VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    const data = await response.json();

    if (!data.success) {
      throw new Error('Recaptcha verification failed');
    }

    return data;
  }
}
