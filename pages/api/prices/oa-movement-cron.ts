import type { NextApiRequest, NextApiResponse } from 'next'
import { Resend } from 'resend'

// Monitoring Configuration
const MONITORING_CONFIG = {
  ETH_TRANSFERS: true,      // Monitor ETH transfers
  ERC20_TRANSFERS: true,    // Monitor ERC20 token transfers
  NFT_TRANSFERS: true,      // Monitor NFT transfers (ERC721/ERC1155)
  CONTRACT_INTERACTIONS: true, // Monitor general contract interactions
  INCOMING_ONLY: false      // If true, only monitor incoming transactions
}

const address = '0x1F12DAE5450522b445Fe1882C4F8D2Cf67B38a43'
const apiKey = process.env.NEXT_PUBLIC_ETHERSCAN_API_KEY
const resendApiKey = process.env.RESEND_API_KEY
const toEmail = process.env.TO_EMAIL
const fromEmail = process.env.FROM_EMAIL

interface Transaction {
  hash: string
  from: string
  to: string
  value: string
  tokenName?: string
  tokenSymbol?: string
  tokenDecimal?: string
  tokenID?: string
  type: 'ETH' | 'ERC20' | 'NFT' | 'CONTRACT'
}

let lastTransactions: { [key: string]: string | null } = {
  eth: null,
  erc20: null,
  nft: null
}

async function fetchTransactions(address: string, apiKey: string): Promise<Transaction[]> {
  const transactions: Transaction[] = []

  // Fetch normal ETH transactions
  if (MONITORING_CONFIG.ETH_TRANSFERS) {
    const ethUrl = `https://api.etherscan.io/api?module=account&action=txlist&address=${address}&sort=desc&apikey=${apiKey}`
    const ethResponse = await fetch(ethUrl)
    const ethData = await ethResponse.json()
    
    if (ethData.status === '1' && ethData.result?.length > 0) {
      const ethTxs = ethData.result
        .filter((tx: any) => tx.value !== '0')
        .map((tx: any) => ({
          ...tx,
          type: 'ETH'
        }))
      transactions.push(...ethTxs)
    }
  }

  // Fetch ERC20 token transfers
  if (MONITORING_CONFIG.ERC20_TRANSFERS) {
    const erc20Url = `https://api.etherscan.io/api?module=account&action=tokentx&address=${address}&sort=desc&apikey=${apiKey}`
    const erc20Response = await fetch(erc20Url)
    const erc20Data = await erc20Response.json()
    
    if (erc20Data.status === '1' && erc20Data.result?.length > 0) {
      const erc20Txs = erc20Data.result.map((tx: any) => ({
        ...tx,
        type: 'ERC20'
      }))
      transactions.push(...erc20Txs)
    }
  }

  // Fetch NFT transfers (both ERC721 and ERC1155)
  if (MONITORING_CONFIG.NFT_TRANSFERS) {
    // ERC721
    const nftUrl = `https://api.etherscan.io/api?module=account&action=tokennfttx&address=${address}&sort=desc&apikey=${apiKey}`
    const nftResponse = await fetch(nftUrl)
    const nftData = await nftResponse.json()
    
    if (nftData.status === '1' && nftData.result?.length > 0) {
      const nftTxs = nftData.result.map((tx: any) => ({
        ...tx,
        type: 'NFT'
      }))
      transactions.push(...nftTxs)
    }

    // ERC1155
    const nft1155Url = `https://api.etherscan.io/api?module=account&action=token1155tx&address=${address}&sort=desc&apikey=${apiKey}`
    const nft1155Response = await fetch(nft1155Url)
    const nft1155Data = await nft1155Response.json()
    
    if (nft1155Data.status === '1' && nft1155Data.result?.length > 0) {
      const nft1155Txs = nft1155Data.result.map((tx: any) => ({
        ...tx,
        type: 'NFT'
      }))
      transactions.push(...nft1155Txs)
    }
  }

  return transactions
}

function formatTransactionDetails(tx: Transaction): string {
  let details = `
    <p><strong>Type:</strong> ${tx.type}</p>
    <p><strong>Hash:</strong> ${tx.hash}</p>
    <p><strong>From:</strong> ${tx.from}</p>
    <p><strong>To:</strong> ${tx.to}</p>
  `

  if (tx.type === 'ETH') {
    details += `<p><strong>Value:</strong> ${Number(tx.value) / 1e18} ETH</p>`
  } else if (tx.type === 'ERC20') {
    const value = Number(tx.value) / Math.pow(10, Number(tx.tokenDecimal))
    details += `
      <p><strong>Token:</strong> ${tx.tokenName} (${tx.tokenSymbol})</p>
      <p><strong>Value:</strong> ${value} ${tx.tokenSymbol}</p>
    `
  } else if (tx.type === 'NFT') {
    details += `
      <p><strong>NFT:</strong> ${tx.tokenName}</p>
      <p><strong>Token ID:</strong> ${tx.tokenID}</p>
    `
  }

  details += `<p><a href="https://etherscan.io/tx/${tx.hash}">View on Etherscan</a></p>`
  return details
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (!apiKey || !resendApiKey || !toEmail || !fromEmail) {
    return res
      .status(500)
      .json({ message: 'Missing required environment variables' })
  }

  try {
    const transactions = await fetchTransactions(address, apiKey)
    
    // Filter for incoming transactions if configured
    const relevantTransactions = MONITORING_CONFIG.INCOMING_ONLY 
      ? transactions.filter(tx => tx.to.toLowerCase() === address.toLowerCase())
      : transactions

    // Check for new transactions
    const newTransactions = relevantTransactions.filter(tx => {
      const isNew = lastTransactions[tx.type.toLowerCase()] !== tx.hash
      if (isNew) {
        lastTransactions[tx.type.toLowerCase()] = tx.hash
      }
      return isNew
    })

    if (newTransactions.length > 0) {
      const resend = new Resend(resendApiKey)
      
      // Send email for new transactions
      const emailResponse = await resend.emails.send({
        from: fromEmail,
        to: toEmail,
        subject: `📬 New ${newTransactions.length > 1 ? 'Transactions' : 'Transaction'} Detected`,
        html: `
          <h2>New ${newTransactions.length > 1 ? 'Transactions' : 'Transaction'} for ${address}</h2>
          ${newTransactions.map(tx => formatTransactionDetails(tx)).join('<hr/>')}
        `,
      })

      return res.status(200).json({ 
        message: 'Email sent for new transactions', 
        count: newTransactions.length,
        response: emailResponse 
      })
    }

    return res.status(200).json({ message: 'No new transactions' })
  } catch (error) {
    console.error('Error:', error)
    return res.status(500).json({ message: 'Failed to process transactions', error: error.message })
  }
}
