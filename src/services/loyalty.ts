import User from '../models/User.js';
import WalletTransaction from '../models/WalletTransaction.js';
import RewardTransaction from '../models/RewardTransaction.js';
import Order from '../models/Order.js';
import { Op } from 'sequelize';

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

export async function validateOrderRedemption(userId: number, orderTotal: number, requestedWallet: unknown, requestedPoints: unknown) {
  const walletAmount = Math.max(0, Number(requestedWallet || 0));
  const rewardPoints = Math.max(0, Math.floor(Number(requestedPoints || 0)));
  if (!Number.isFinite(walletAmount) || !Number.isFinite(rewardPoints)) throw new Error('Wallet or reward amount is invalid');
  const wallet = await walletBalance(userId);
  const points = await rewardBalance(userId);
  // Wallet money is a stored customer balance, so it may cover the entire order.
  // Keep the established 20% cap for reward points, while never allowing the
  // combined redemption to exceed what is still payable.
  const maxRedeemable = Math.max(0, Number(orderTotal));
  const maxRewardPoints = Math.min(maxRedeemable * 0.2, Math.max(0, maxRedeemable - walletAmount));
  if (walletAmount > wallet + 0.001) throw new Error('Wallet balance is insufficient');
  if (rewardPoints > points) throw new Error('Reward points balance is insufficient');
  if (rewardPoints > maxRewardPoints + 0.001) throw new Error('Reward points can cover up to 20% of this order after wallet redemption');
  if (walletAmount + rewardPoints > maxRedeemable + 0.001) throw new Error('Wallet and reward amount cannot exceed the order total');
  return { walletAmount: Number(walletAmount.toFixed(2)), rewardPoints };
}

export async function redeemOrderBalances(userId: number, orderId: number, orderTotal: number, requestedWallet: unknown, requestedPoints: unknown) {
  const redemption = await validateOrderRedemption(userId, orderTotal, requestedWallet, requestedPoints);
  if (redemption.walletAmount > 0) {
    await addWalletTransaction({ userId, orderId, type: 'redeem', amount: -redemption.walletAmount, description: `Wallet used for order #${orderId}` });
  }
  if (redemption.rewardPoints > 0) {
    await addRewardTransaction({ userId, orderId, type: 'redeem', points: -redemption.rewardPoints, description: `Reward points used for order #${orderId}` });
  }
  return redemption;
}

export async function refundOrderBalances(orderId: number) {
  const walletDebit = await WalletTransaction.findOne({ where: { orderId, type: 'redeem', amount: { [Op.lt]: 0 } } });
  if (walletDebit?.userId) {
    const existingRefund = await WalletTransaction.findOne({ where: { orderId, type: 'refund' } });
    if (!existingRefund) await addWalletTransaction({ userId: walletDebit.userId, orderId, type: 'refund', amount: Math.abs(Number(walletDebit.amount)), description: `Wallet redemption refunded for order #${orderId}` });
  }
  const rewardDebit = await RewardTransaction.findOne({ where: { orderId, type: 'redeem', points: { [Op.lt]: 0 } } });
  if (rewardDebit?.userId) {
    const existingRefund = await RewardTransaction.findOne({ where: { orderId, type: 'refund' } });
    if (!existingRefund) await addRewardTransaction({ userId: rewardDebit.userId, orderId, type: 'refund', points: Math.abs(Number(rewardDebit.points)), description: `Reward points refunded for order #${orderId}` });
  }
}

export async function awardOrderRewards(order: Order) {
  if (order.paymentStatus !== 'paid') return null;

  const user = await User.findOne({ where: { email: order.email } });
  if (!user) return null;

  const pointsPerRupee = Number(process.env.REWARD_POINTS_PER_RUPEE || 0.1);
  let orderReward: RewardTransaction | null = null;
  if (pointsPerRupee > 0) {
    const existing = await RewardTransaction.findOne({ where: { orderId: order.id, userId: user.id, type: 'earn' } });
    const points = Math.floor(Number(order.subtotal ?? order.total) * pointsPerRupee);
    if (!existing && points > 0) {
      orderReward = await addRewardTransaction({
        userId: user.id,
        legacyUserId: user.legacyUserId,
        orderId: order.id,
        type: 'earn',
        points,
        description: `Reward points earned for order #${order.id}`,
      });
    } else {
      orderReward = existing;
    }
  }

  // Referral rewards apply once, on the invited customer's first paid order.
  if (user.referredByUserId && user.referredByUserId !== user.id) {
    const earlierPaidOrder = await Order.findOne({
      where: { email: user.email, paymentStatus: 'paid', id: { [Op.ne]: order.id } },
      attributes: ['id'],
    });
    if (!earlierPaidOrder) {
      const referrer = await User.findByPk(user.referredByUserId);
      if (referrer && referrer.role === 'user') {
        const referrerRewardExists = await RewardTransaction.findOne({ where: { orderId: order.id, userId: referrer.id, type: 'referral' } });
        if (!referrerRewardExists) {
          const referrerPoints = Math.max(0, Math.floor(Number(process.env.REFERRAL_REFERRER_POINTS || 100)));
          if (referrerPoints > 0) await addRewardTransaction({
            userId: referrer.id,
            legacyUserId: referrer.legacyUserId,
            orderId: order.id,
            type: 'referral',
            points: referrerPoints,
            description: `Referral reward for referralUserId=${user.id} first paid order #${order.id}`,
          });
        }

        const friendRewardExists = await RewardTransaction.findOne({ where: { orderId: order.id, userId: user.id, type: 'referral_bonus' } });
        if (!friendRewardExists) {
          const friendPoints = Math.max(0, Math.floor(Number(process.env.REFERRAL_FRIEND_POINTS || 50)));
          if (friendPoints > 0) await addRewardTransaction({
            userId: user.id,
            legacyUserId: user.legacyUserId,
            orderId: order.id,
            type: 'referral_bonus',
            points: friendPoints,
            description: `Welcome referral points for first paid order #${order.id}`,
          });
        }
      }
    }
  }

  return orderReward;
}
