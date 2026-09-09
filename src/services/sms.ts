function smsConfig() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM;
  return accountSid && authToken && from ? { accountSid, authToken, from } : null;
}

export async function sendLoginOtpSms(phone: string, code: string) {
  const config = smsConfig();
  if (!config) return false;
  const body = new URLSearchParams({ To: phone, From: config.from, Body: `Your Foodiens login code is ${code}. It expires in 10 minutes.` });
  const credentials = Buffer.from(`${config.accountSid}:${config.authToken}`).toString('base64');
  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}/Messages.json`, {
    method: 'POST',
    headers: { Authorization: `Basic ${credentials}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!response.ok) {
    console.error('SMS delivery failed:', response.status, await response.text());
    return false;
  }
  return true;
}
