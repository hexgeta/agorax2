import { BigInt, Bytes, Address } from "@graphprotocol/graph-ts";
import {
  OrderPlaced,
  OrderCancelled,
  OrderFilled,
  OrderProceedsCollected,
  ProceedsCollectionFailed,
  OrderExpirationUpdated,
  TokenWhitelisted,
  TokenStatusChanged,
  Paused,
  FeeAddressUpdated,
  ListingFeeUpdated,
  ProtocolFeeUpdated,
} from "../generated/AgoraX/AgoraX";
import {
  Order,
  OrderBuyToken,
  OrderFill,
  User,
  Token,
  ProtocolStats,
  DailyStats,
} from "../generated/schema";

const PROTOCOL_STATS_ID = "protocol";
const SECONDS_PER_DAY = 86400;

// Helper to get or create ProtocolStats
function getOrCreateProtocolStats(): ProtocolStats {
  let stats = ProtocolStats.load(PROTOCOL_STATS_ID);
  if (stats == null) {
    stats = new ProtocolStats(PROTOCOL_STATS_ID);
    stats.totalOrders = 0;
    stats.totalFills = 0;
    stats.totalCancellations = 0;
    stats.totalUsers = 0;
    stats.totalTokens = 0;
    stats.listingFee = BigInt.fromI32(0);
    stats.protocolFee = BigInt.fromI32(0);
    stats.feeAddress = null;
    stats.isPaused = false;
    stats.lastUpdatedAt = BigInt.fromI32(0);
  }
  return stats;
}

// Helper to get or create User
function getOrCreateUser(address: Bytes, timestamp: BigInt): User {
  let user = User.load(address.toHexString());
  if (user == null) {
    user = new User(address.toHexString());
    user.address = address;
    user.totalOrdersCreated = 0;
    user.totalOrdersFilled = 0;
    user.totalOrdersCancelled = 0;
    user.firstSeenAt = timestamp;
    user.lastActiveAt = timestamp;

    // Update protocol stats
    let stats = getOrCreateProtocolStats();
    stats.totalUsers = stats.totalUsers + 1;
    stats.save();
  }
  return user;
}

// Helper to get or create Token
function getOrCreateToken(address: Bytes, timestamp: BigInt): Token {
  let token = Token.load(address.toHexString());
  if (token == null) {
    token = new Token(address.toHexString());
    token.address = address;
    token.whitelistIndex = null;
    token.isActive = true;
    token.whitelistedAt = timestamp;
    token.totalVolumeAsSellToken = BigInt.fromI32(0);
    token.totalOrdersAsSellToken = 0;
  }
  return token;
}

// Helper to get or create DailyStats
function getOrCreateDailyStats(timestamp: BigInt): DailyStats {
  let dayTimestamp = timestamp.div(BigInt.fromI32(SECONDS_PER_DAY));
  let id = dayTimestamp.toString();
  let stats = DailyStats.load(id);
  if (stats == null) {
    stats = new DailyStats(id);
    stats.date = dayTimestamp.times(BigInt.fromI32(SECONDS_PER_DAY));
    stats.ordersCreated = 0;
    stats.ordersFilled = 0;
    stats.ordersCancelled = 0;
    stats.uniqueUsers = 0;
    stats.newUsers = 0;
  }
  return stats;
}

// Event Handlers

export function handleOrderPlaced(event: OrderPlaced): void {
  let orderId = event.params.orderID.toString();
  let order = new Order(orderId);

  // Get or create user
  let user = getOrCreateUser(event.params.user, event.block.timestamp);
  user.totalOrdersCreated = user.totalOrdersCreated + 1;
  user.lastActiveAt = event.block.timestamp;
  user.save();

  // Get or create sell token
  let sellToken = getOrCreateToken(event.params.sellToken, event.block.timestamp);
  sellToken.totalOrdersAsSellToken = sellToken.totalOrdersAsSellToken + 1;
  sellToken.totalVolumeAsSellToken = sellToken.totalVolumeAsSellToken.plus(event.params.sellAmount);
  sellToken.save();

  // Set order fields
  order.orderID = event.params.orderID;
  order.maker = user.id;
  order.sellToken = sellToken.id;
  order.sellAmount = event.params.sellAmount;
  order.remainingSellAmount = event.params.sellAmount;
  order.expirationTime = event.params.expirationTime;
  order.allOrNothing = event.params.allOrNothing;
  order.status = "OPEN";
  order.createdAt = event.block.timestamp;
  order.createdAtBlock = event.block.number;
  order.createdTxHash = event.transaction.hash;
  order.cancelledAt = null;
  order.cancelledTxHash = null;
  order.filledAt = null;
  order.proceedsCollected = false;
  order.proceedsCollectedAt = null;
  order.totalFillCount = 0;
  order.totalBuyAmountReceived = BigInt.fromI32(0);
  order.save();

  // Create OrderBuyToken entities
  let buyTokensIndex = event.params.buyTokensIndex;
  let buyAmounts = event.params.buyAmounts;
  for (let i = 0; i < buyTokensIndex.length; i++) {
    let buyTokenId = orderId + "-" + buyTokensIndex[i].toString();
    let orderBuyToken = new OrderBuyToken(buyTokenId);
    orderBuyToken.order = orderId;
    orderBuyToken.tokenIndex = buyTokensIndex[i];
    orderBuyToken.token = null; // Will be linked when token is whitelisted
    orderBuyToken.buyAmount = buyAmounts[i];
    orderBuyToken.filledAmount = BigInt.fromI32(0);
    orderBuyToken.save();
  }

  // Update protocol stats
  let stats = getOrCreateProtocolStats();
  stats.totalOrders = stats.totalOrders + 1;
  stats.lastUpdatedAt = event.block.timestamp;
  stats.save();

  // Update daily stats
  let dailyStats = getOrCreateDailyStats(event.block.timestamp);
  dailyStats.ordersCreated = dailyStats.ordersCreated + 1;
  dailyStats.save();
}

export function handleOrderCancelled(event: OrderCancelled): void {
  let order = Order.load(event.params.orderID.toString());
  if (order == null) return;

  order.status = "CANCELLED";
  order.cancelledAt = event.block.timestamp;
  order.cancelledTxHash = event.transaction.hash;
  order.save();

  // Update user stats
  let user = User.load(order.maker);
  if (user != null) {
    user.totalOrdersCancelled = user.totalOrdersCancelled + 1;
    user.lastActiveAt = event.block.timestamp;
    user.save();
  }

  // Update protocol stats
  let stats = getOrCreateProtocolStats();
  stats.totalCancellations = stats.totalCancellations + 1;
  stats.lastUpdatedAt = event.block.timestamp;
  stats.save();

  // Update daily stats
  let dailyStats = getOrCreateDailyStats(event.block.timestamp);
  dailyStats.ordersCancelled = dailyStats.ordersCancelled + 1;
  dailyStats.save();
}

export function handleOrderFilled(event: OrderFilled): void {
  let orderId = event.params.orderID.toString();
  let order = Order.load(orderId);
  if (order == null) return;

  // Create fill entity
  let fillId = event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  let fill = new OrderFill(fillId);

  // Get or create buyer
  let buyer = getOrCreateUser(event.params.buyer, event.block.timestamp);
  buyer.totalOrdersFilled = buyer.totalOrdersFilled + 1;
  buyer.lastActiveAt = event.block.timestamp;
  buyer.save();

  fill.order = orderId;
  fill.buyer = buyer.id;
  fill.buyTokenIndex = event.params.buyTokenIndex;
  fill.buyToken = null; // Can be linked later if needed
  fill.buyAmount = event.params.buyAmount;
  fill.timestamp = event.block.timestamp;
  fill.blockNumber = event.block.number;
  fill.txHash = event.transaction.hash;
  fill.save();

  // Update order
  order.totalFillCount = order.totalFillCount + 1;
  order.totalBuyAmountReceived = order.totalBuyAmountReceived.plus(event.params.buyAmount);

  // Update order buy token filled amount
  let buyTokenId = orderId + "-" + event.params.buyTokenIndex.toString();
  let orderBuyToken = OrderBuyToken.load(buyTokenId);
  if (orderBuyToken != null) {
    orderBuyToken.filledAmount = orderBuyToken.filledAmount.plus(event.params.buyAmount);
    orderBuyToken.save();
  }

  // Check if order is fully filled (simplified - would need more logic for actual calculation)
  if (order.status == "OPEN") {
    order.status = "PARTIALLY_FILLED";
  }
  order.filledAt = event.block.timestamp;
  order.save();

  // Update protocol stats
  let stats = getOrCreateProtocolStats();
  stats.totalFills = stats.totalFills + 1;
  stats.lastUpdatedAt = event.block.timestamp;
  stats.save();

  // Update daily stats
  let dailyStats = getOrCreateDailyStats(event.block.timestamp);
  dailyStats.ordersFilled = dailyStats.ordersFilled + 1;
  dailyStats.save();
}

export function handleOrderProceedsCollected(event: OrderProceedsCollected): void {
  let order = Order.load(event.params.orderID.toString());
  if (order == null) return;

  order.proceedsCollected = true;
  order.proceedsCollectedAt = event.block.timestamp;

  // If proceeds collected and fully filled, mark as FILLED
  if (order.status == "PARTIALLY_FILLED") {
    order.status = "FILLED";
  }
  order.save();

  // Update user
  let user = User.load(order.maker);
  if (user != null) {
    user.lastActiveAt = event.block.timestamp;
    user.save();
  }
}

export function handleProceedsCollectionFailed(event: ProceedsCollectionFailed): void {
  // Log the failure - the order proceeds were partially collected
  // The successful tokens are handled by OrderProceedsCollected
  // This just tracks which token failed for debugging/UI notification
  let order = Order.load(event.params.orderID.toString());
  if (order == null) return;

  // Update user activity
  let user = User.load(order.maker);
  if (user != null) {
    user.lastActiveAt = event.block.timestamp;
    user.save();
  }
}

export function handleOrderExpirationUpdated(event: OrderExpirationUpdated): void {
  let order = Order.load(event.params.orderID.toString());
  if (order == null) return;

  order.expirationTime = event.params.newExpiration;
  order.save();
}

export function handleTokenWhitelisted(event: TokenWhitelisted): void {
  let token = getOrCreateToken(event.params.token, event.block.timestamp);
  token.isActive = true;
  token.whitelistedAt = event.block.timestamp;
  token.save();

  // Update protocol stats
  let stats = getOrCreateProtocolStats();
  stats.totalTokens = stats.totalTokens + 1;
  stats.lastUpdatedAt = event.block.timestamp;
  stats.save();
}

export function handleTokenStatusChanged(event: TokenStatusChanged): void {
  let token = Token.load(event.params.token.toHexString());
  if (token == null) return;

  token.isActive = event.params.isActive;
  token.save();
}

export function handlePaused(event: Paused): void {
  let stats = getOrCreateProtocolStats();
  stats.isPaused = event.params.paused;
  stats.lastUpdatedAt = event.block.timestamp;
  stats.save();
}

export function handleFeeAddressUpdated(event: FeeAddressUpdated): void {
  let stats = getOrCreateProtocolStats();
  stats.feeAddress = event.params.newAddress;
  stats.lastUpdatedAt = event.block.timestamp;
  stats.save();
}

export function handleListingFeeUpdated(event: ListingFeeUpdated): void {
  let stats = getOrCreateProtocolStats();
  stats.listingFee = event.params.newFee;
  stats.lastUpdatedAt = event.block.timestamp;
  stats.save();
}

export function handleProtocolFeeUpdated(event: ProtocolFeeUpdated): void {
  let stats = getOrCreateProtocolStats();
  stats.protocolFee = event.params.newFee;
  stats.lastUpdatedAt = event.block.timestamp;
  stats.save();
}
