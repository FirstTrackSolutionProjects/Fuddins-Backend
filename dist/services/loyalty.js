import User from '../models/User.js';
import WalletTransaction from '../models/WalletTransaction.js';
import RewardTransaction from '../models/RewardTransaction.js';
import { Op } from 'sequelize';
export const MAX_REDEMPTION_RATE = 0.2;
export async function walletBalance(userId) {
    const transactions = await WalletTransaction.findAll({ where: { userId, status: 'completed' } });
    return transactions.reduce((sum, transaction) => sum + Number(transaction.amount), 0);
}
export async function rewardBalance(userId) {
    const transactions = await RewardTransaction.findAll({ where: { userId, status: 'completed' } });
    return transactions.reduce((sum, transaction) => sum + Number(transaction.points), 0);
}
export async function addWalletTransaction(payload) {
    const balanceAfter = (await walletBalance(payload.userId)) + payload.amount;
    return WalletTransaction.create({ ...payload, balanceAfter, status: 'completed' });
}
export async function addRewardTransaction(payload) {
    const balanceAfter = (await rewardBalance(payload.userId)) + payload.points;
    return RewardTransaction.create({ ...payload, balanceAfter, status: 'completed' });
}
export async function validateOrderRedemption(userId, orderTotal, requestedWallet, requestedPoints) {
    const walletAmount = Math.max(0, Number(requestedWallet || 0));
    const rewardPoints = Math.max(0, Math.floor(Number(requestedPoints || 0)));
    if (!Number.isFinite(walletAmount) || !Number.isFinite(rewardPoints))
        throw new Error('Wallet or reward amount is invalid');
    const wallet = await walletBalance(userId);
    const points = await rewardBalance(userId);
    const maxRedeemable = Math.max(0, Number(orderTotal) * MAX_REDEMPTION_RATE);
    if (walletAmount > wallet + 0.001)
        throw new Error('Wallet balance is insufficient');
    if (rewardPoints > points)
        throw new Error('Reward points balance is insufficient');
    if (walletAmount + rewardPoints > maxRedeemable + 0.001)
        throw new Error('Wallet and points can cover up to 20% of this order');
    return { walletAmount: Number(walletAmount.toFixed(2)), rewardPoints };
}
export async function redeemOrderBalances(userId, orderId, orderTotal, requestedWallet, requestedPoints) {
    const redemption = await validateOrderRedemption(userId, orderTotal, requestedWallet, requestedPoints);
    if (redemption.walletAmount > 0) {
        await addWalletTransaction({ userId, orderId, type: 'redeem', amount: -redemption.walletAmount, description: `Wallet used for order #${orderId}` });
    }
    if (redemption.rewardPoints > 0) {
        await addRewardTransaction({ userId, orderId, type: 'redeem', points: -redemption.rewardPoints, description: `Reward points used for order #${orderId}` });
    }
    return redemption;
}
export async function refundOrderBalances(orderId) {
    const walletDebit = await WalletTransaction.findOne({ where: { orderId, type: 'redeem', amount: { [Op.lt]: 0 } } });
    if (walletDebit?.userId) {
        const existingRefund = await WalletTransaction.findOne({ where: { orderId, type: 'refund' } });
        if (!existingRefund)
            await addWalletTransaction({ userId: walletDebit.userId, orderId, type: 'refund', amount: Math.abs(Number(walletDebit.amount)), description: `Wallet redemption refunded for order #${orderId}` });
    }
    const rewardDebit = await RewardTransaction.findOne({ where: { orderId, type: 'redeem', points: { [Op.lt]: 0 } } });
    if (rewardDebit?.userId) {
        const existingRefund = await RewardTransaction.findOne({ where: { orderId, type: 'refund' } });
        if (!existingRefund)
            await addRewardTransaction({ userId: rewardDebit.userId, orderId, type: 'refund', points: Math.abs(Number(rewardDebit.points)), description: `Reward points refunded for order #${orderId}` });
    }
}
export async function awardOrderRewards(order) {
    const pointsPerRupee = Number(process.env.REWARD_POINTS_PER_RUPEE || 0.1);
    if (!pointsPerRupee)
        return null;
    const user = await User.findOne({ where: { email: order.email } });
    if (!user)
        return null;
    const existing = await RewardTransaction.findOne({ where: { orderId: order.id, type: 'earn' } });
    if (existing)
        return existing;
    const points = Math.floor(Number(order.subtotal ?? order.total) * pointsPerRupee);
    if (points <= 0)
        return null;
    return addRewardTransaction({
        userId: user.id,
        legacyUserId: user.legacyUserId,
        orderId: order.id,
        type: 'earn',
        points,
        description: `Reward points earned for order #${order.id}`,
    });
}
