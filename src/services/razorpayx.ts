type Destination = { method: 'upi' | 'bank_account'; upiId?: string; accountNumber?: string; ifsc?: string; accountHolderName?: string };

function credentials() {
  const keyId = process.env.RAZORPAYX_KEY_ID || process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAYX_KEY_SECRET || process.env.RAZORPAY_KEY_SECRET;
  const accountNumber = process.env.RAZORPAYX_ACCOUNT_NUMBER;
  if (!keyId || !keySecret || !accountNumber) throw new Error('RazorpayX is not configured. Add RAZORPAYX_KEY_ID, RAZORPAYX_KEY_SECRET and RAZORPAYX_ACCOUNT_NUMBER.');
  return { keyId, keySecret, accountNumber };
}

async function api(path: string, body: unknown) {
  const { keyId, keySecret } = credentials();
  const response = await fetch(`https://api.razorpay.com/v1${path}`, { method: 'POST', headers: { Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const result = await response.json() as any;
  if (!response.ok) throw new Error(result?.error?.description || 'RazorpayX payout could not be created');
  return result;
}

export async function createRazorpayXPayout(destination: Destination, amount: number, referenceId: string) {
  const { accountNumber } = credentials();
  const contact = await api('/contacts', { name: destination.accountHolderName || 'Delivery Partner', type: 'employee', reference_id: referenceId });
  const fundAccount = await api('/fund_accounts', { contact_id: contact.id, account_type: destination.method === 'upi' ? 'vpa' : 'bank_account', ...(destination.method === 'upi' ? { vpa: { address: destination.upiId } } : { bank_account: { name: destination.accountHolderName, ifsc: destination.ifsc, account_number: destination.accountNumber } }) });
  return api('/payouts', { account_number: accountNumber, fund_account_id: fundAccount.id, amount: Math.round(amount * 100), currency: 'INR', mode: destination.method === 'upi' ? 'UPI' : 'IMPS', purpose: 'payout', queue_if_low_balance: true, reference_id: referenceId, narration: 'Delivery partner payout' });
}
