import User from '../models/User.js';
import WalletTransaction from '../models/WalletTransaction.js';
import RewardTransaction from '../models/RewardTransaction.js';
import Order from '../models/Order.js';

export async function walletBalance(userId: number) {
  const transactions = await WalletTransaction.findAll({ where: { userId, status: 'completed' } });
  return transactions.reduce((sum, transaction) => sum + Number(transaction.amount), 0);
}

export async function rewardBalance(userId: number) {
  const transactions = await RewardTransaction.findAll({ where: { userId, status: 'completed' } });
  return transactions.reduce((sum, transaction) => sum + Number(transaction.points), 0);
}

export async function addWalletTransaction(payload: {
  userId: number;
  orderId?: number | null;
  type: string;
  amount: number;
  description?: string | null;
  legacyUserId?: number | null;
}) {
  const balanceAfter = (await walletBalance(payload.userId)) + payload.amount;
  return WalletTransaction.create({ ...payload, balanceAfter, status: 'completed' });
}

export async function addRewardTransaction(payload: {
  userId: number;
  orderId?: number | null;
  type: string;
  points: number;
  description?: string | null;
  legacyUserId?: number | null;
}) {
  const balanceAfter = (await rewardBalance(payload.userId)) + payload.points;
  return RewardTransaction.create({ ...payload, balanceAfter, status: 'completed' });
}

export async function awardOrderRewards(order: Order) {
  const pointsPerRupee = Number(process.env.REWARD_POINTS_PER_RUPEE || 0.01);
  if (!pointsPerRupee) return null;

  const user = await User.findOne({ where: { email: order.email } });
  if (!user) return null;

  const existing = await RewardTransaction.findOne({ where: { orderId: order.id, type: 'earn' } });
  if (existing) return existing;

  const points = Math.floor(Number(order.subtotal ?? order.total) * pointsPerRupee);
  if (points <= 0) return null;

  return addRewardTransaction({
    userId: user.id,
    legacyUserId: user.legacyUserId,
    orderId: order.id,
    type: 'earn',
    points,
    description: `Reward points earned for order #${order.id}`,
  });
}
