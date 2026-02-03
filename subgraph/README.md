# AgoraX Subgraph

This subgraph indexes the AgoraX Limit Order Protocol on PulseChain.

## Setup

```bash
cd subgraph
npm install
```

## Development

Generate types from the schema and ABI:

```bash
npm run codegen
```

Build the subgraph:

```bash
npm run build
```

## Deployment to graph.pulsechain.com

1. Create the subgraph:
```bash
npm run create
```

2. Deploy:
```bash
npm run deploy
```

## GraphQL Endpoint

Once deployed, your subgraph will be available at:
```
https://graph.pulsechain.com/subgraphs/name/agorax/agorax
```

## Example Queries

### Get all open orders

```graphql
{
  orders(where: { status: OPEN }, first: 100, orderBy: createdAt, orderDirection: desc) {
    id
    orderID
    maker {
      address
    }
    sellToken {
      address
    }
    sellAmount
    remainingSellAmount
    expirationTime
    createdAt
    buyTokens {
      tokenIndex
      buyAmount
      filledAmount
    }
  }
}
```

### Get orders by user

```graphql
{
  user(id: "0x...") {
    address
    totalOrdersCreated
    totalOrdersFilled
    ordersCreated(first: 10, orderBy: createdAt, orderDirection: desc) {
      id
      status
      sellAmount
      createdAt
    }
  }
}
```

### Get protocol stats

```graphql
{
  protocolStats(id: "protocol") {
    totalOrders
    totalFills
    totalCancellations
    totalUsers
    totalTokens
    listingFee
    protocolFee
    isPaused
  }
}
```

### Get daily statistics

```graphql
{
  dailyStats(first: 30, orderBy: date, orderDirection: desc) {
    date
    ordersCreated
    ordersFilled
    ordersCancelled
    uniqueUsers
  }
}
```

### Get recent fills

```graphql
{
  orderFills(first: 20, orderBy: timestamp, orderDirection: desc) {
    order {
      orderID
      maker {
        address
      }
    }
    buyer {
      address
    }
    buyAmount
    timestamp
    txHash
  }
}
```

## Schema

See [schema.graphql](./schema.graphql) for the full schema definition.

### Main Entities

- **Order**: Limit orders with status tracking
- **OrderFill**: Individual fill transactions
- **User**: User statistics and order history
- **Token**: Whitelisted tokens and volume
- **ProtocolStats**: Protocol-wide metrics
- **DailyStats**: Daily aggregated statistics
