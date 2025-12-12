import { TOKEN_CONSTANTS } from '@/constants/crypto';
import logoManifest from '@/constants/logo-manifest.json';

// ===================================
// PRIORITY TOKEN ORDER
// These tokens appear first in dropdowns and are preloaded first for optimal UX
// Edit this list to change the order of priority tokens across the app
// ===================================
export const PRIORITY_TOKEN_ADDRESSES = [
  '0x2b591e99afe9f32eaa6214f7b7629768c40eeb39', // HEX - HEX on Pls
  '0x57fde0a71132198BBeC939B98976993d8D89D225', // weHEX - Wrapped HEX from Eth
  '0x000000000000000000000000000000000000dead', // PLS - Pulse (mapped internally)
  '0x95b303987a60c71504d99aa1b13b4da07b0790ab', // PLSX - PulseX
  '0x2fa878ab3f87cc1c9737fc071108f904c0b0c95d', // INC - Incentive
  '0xefd766ccb38eaf1dfd701853bfce31359239f305', // weDAI - Wrapped DAI from Eth
  '0x15d38573d2feeb82e7ad5187ab8c1d52810b1f07', // weUSDC - Wrapped USDC from Eth
  '0x0cb6f5a34ad42ec934882a05265a7d5f59b51a2f', // weUSDT - Wrapped USDT from Eth
  '0x0deed1486bc52aa0d3e6f8849cec5add6598a162', // USDL - USDL (Liquid Loans)
  '0xeb6b7932da20c6d7b3a899d5887d86dfb09a6408', // PXDC - PXDC Stablecoin (Powercity)
  '0x1fe0319440a672526916c232eaee4808254bdb00', // HEXDC - HEXDC Stablecoin
  '0x02dcdd04e3f455d838cd1249292c58f3b79e3c3c', // weWETH - Wrapped WETH from Eth
  // MAXI tokens
  '0x0d86eb9f43c57f6ff3bc9e23d8f9d82503f0e84b', // MAXI
  '0x6b32022693210cd2cfc466b9ac0085de8fc34ea6', // DECI
  '0x6b0956258ff7bd7645aa35369b55b61b8e6d6140', // LUCKY
  '0xf55cd1e399e1cc3d95303048897a680be3313308', // TRIO
  '0xe9f84d418b008888a992ff8c6d22389c2c3504e0', // BASE
  '0x352511c9bc5d47dbc122883ed9353e987d10a3ba', // weMAXI
  '0x189a3ca3cc1337e85c7bc0a43b8d3457fd5aae89', // weDECI
  '0x8924f56df76ca9e7babb53489d7bef4fb7caff19', // weLUCKY
  '0x0f3c6134f4022d85127476bc4d3787860e5c5569', // weTRIO
  '0xda073388422065fe8d3b5921ec2ae475bae57bed', // weBASE
];

// Function to get token logo URL based on ticker
function getTokenLogo(ticker: string): string {
  // Special case mappings for tokens that use different logos
  const specialCases: Record<string, string> = {
    'WPLS': 'PLS', // Wrapped PLS uses PLS logo
    'DAI': 'weDAI', // DAI uses weDAI logo
    'eDAI': 'EDAI',
  };
  
  // Check special cases first
  const lookupTicker = specialCases[ticker] || ticker;
  
  // Look up the actual format from manifest (no 404s!)
  const format = (logoManifest as Record<string, string>)[lookupTicker];
  if (format) {
    return `/coin-logos/${lookupTicker}.${format}`;
  }
  
  // Fallback to default if not in manifest
  return '/coin-logos/default.svg';
}

// Create a map of token addresses to token info from TOKEN_CONSTANTS
const TOKEN_MAP = new Map<string, { ticker: string; name: string; decimals: number; logo: string }>(
  TOKEN_CONSTANTS
    .filter((token): token is typeof token & { a: string } => token.a !== null && token.a.trim() !== '')
    .map(token => [
      token.a.toLowerCase(),
      {
        ticker: token.ticker,
        name: token.name,
        decimals: token.decimals,
        logo: getTokenLogo(token.ticker)
      }
    ] as [string, { ticker: string; name: string; decimals: number; logo: string }])
);

// Add contract's native address mapping to PLS
TOKEN_MAP.set('0x000000000000000000000000000000000000dead', {
  ticker: 'PLS',
  name: 'Pulse',
  decimals: 18,
  logo: getTokenLogo('PLS')
});


// Function to get token info by address
export function getTokenInfo(address: string): {
  ticker: string;
  name: string;
  decimals: number;
  logo: string;
  address: string;
} {
  // Handle native token mapping - contract uses 0xdEaD, frontend uses 0x0
  const normalizedAddress = address.toLowerCase();
  const nativeAddresses = ['0x0', '0x0000000000000000000000000000000000000000', '0x000000000000000000000000000000000000dead'];
  
  let searchAddress = normalizedAddress;
  if (nativeAddresses.includes(normalizedAddress)) {
    // Try to find PLS token info using any of the native addresses
    for (const nativeAddr of nativeAddresses) {
      const tokenInfo = TOKEN_MAP.get(nativeAddr);
      if (tokenInfo) {
        return {
          ...tokenInfo,
          address: address // Return the original address passed in
        };
      }
    }
  }
  
  const tokenInfo = TOKEN_MAP.get(searchAddress);
  if (tokenInfo) {
    return {
      ...tokenInfo,
      address: address
    };
  }
  
  // Fallback for unknown tokens
  return {
    ticker: formatAddress(address),
    name: 'Unknown Token',
    decimals: 18,
    logo: '/coin-logos/default.svg',
    address: address
  };
}

// Function to format address for display
export function formatAddress(address: string): string {
  // Format address as '0x...[last 4 characters]'
  if (address.startsWith('0x') && address.length > 6) {
    return `0x...${address.slice(-4)}`;
  }
  return address; // Return original if not a long enough address to truncate
}

// Function to format token ticker for display (convert 'we' to 'e')
export function formatTokenTicker(ticker: string, chainId?: number): string {
  // Show tPLS for PLS when on testnet (chain 943)
  if (ticker === 'PLS' && chainId === 943) {
    return 'tPLS';
  }
  
  // Convert 'we' prefixed tokens to 'e' prefixed for display
  if (ticker.startsWith('we')) {
    return 'e' + ticker.slice(2);
  }
  return ticker;
}

// Testnet/Mainnet contract token whitelist mapping (index -> address)
// Based on the AgoraX contract's whitelist order
const CONTRACT_TOKEN_MAP: Record<number, string> = {
  0: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE', // tPLS - Native Pulse
  1: '0x2b591e99afE9f32eAA6214f7B7629768c40Eeb39', // HEX
  2: '0x8a810ea8B121d08342E9e7696f4a9915cBE494B7', // tPLSX - PulseX
  3: '0x826e4e896CC2f5B371Cd7Bb0bd929DB3e3DB67c0', // tDAI
  4: '0x3819f64f282bf135d62168C1e513280dAF905e06', // HDRN - Hedron
  5: '0xfc4913214444aF5c715cc9F7b52655e788A569ed', // ICSA
  6: '0xe9f84d418B008888A992Ff8c6D22389C2C3504e0', // BASE
  7: '0xF55cD1e399e1cc3D95303048897a680be3313308', // TRIO
  8: '0x6B0956258fF7bd7645aa35369B55B61b8e6d6140', // LUCKY
  9: '0x6b32022693210cD2Cfc466b9Ac0085DE8fC34eA6', // DECI
  10: '0x0d86EB9f43C57f6FF3BC9E23D8F9d82503f0e84b', // MAXI
};

// Create reverse mapping (address -> index) for quick lookups
const ADDRESS_TO_INDEX_MAP = new Map<string, number>();
Object.entries(CONTRACT_TOKEN_MAP).forEach(([index, address]) => {
  ADDRESS_TO_INDEX_MAP.set(address.toLowerCase(), parseInt(index));
});

// Function to get token info by index (for buy tokens)
// This maps contract token indices to actual token addresses
export function getTokenInfoByIndex(index: number) {
  const address = CONTRACT_TOKEN_MAP[index];
  if (address) {
    const tokenInfo = getTokenInfo(address);
    return {
      ...tokenInfo,
      address: address
    };
  }
  
  return {
    address: '0x0000000000000000000000000000000000000000',
    ticker: 'UNKNOWN',
    name: 'Unknown Token',
    logo: '/coin-logos/default.svg',
    decimals: 18
  };
}

// Function to get contract whitelist index by token address
// Returns -1 if token is not in the whitelist
export function getContractWhitelistIndex(address: string): number {
  const normalizedAddress = address.toLowerCase();
  return ADDRESS_TO_INDEX_MAP.get(normalizedAddress) ?? -1;
}

// Function to parse token amount to wei based on token decimals
export function parseTokenAmount(amount: string, decimals: number): bigint {
  const cleanAmount = amount.replace(/,/g, '');
  const [integerPart, decimalPart = ''] = cleanAmount.split('.');
  
  // Pad decimal part to match token decimals
  const paddedDecimalPart = decimalPart.padEnd(decimals, '0').slice(0, decimals);
  
  // Combine integer and decimal parts
  const fullAmount = integerPart + paddedDecimalPart;
  
  return BigInt(fullAmount);
}

// Function to format token amount from wei based on token decimals
export function formatTokenAmount(amount: bigint, decimals: number): string {
  const amountStr = amount.toString();
  
  if (amountStr.length <= decimals) {
    // Amount is less than 1 token
    const paddedAmount = amountStr.padStart(decimals, '0');
    const decimalPart = paddedAmount.slice(-decimals);
    return `0.${decimalPart}`.replace(/\.?0+$/, '') || '0';
  }
  
  const integerPart = amountStr.slice(0, -decimals);
  const decimalPart = amountStr.slice(-decimals);
  
  // Remove trailing zeros from decimal part
  const trimmedDecimalPart = decimalPart.replace(/0+$/, '');
  
  if (trimmedDecimalPart === '') {
    return integerPart;
  }
  
  return `${integerPart}.${trimmedDecimalPart}`;
}
