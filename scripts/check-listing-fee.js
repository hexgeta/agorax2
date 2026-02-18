const { createPublicClient, http, formatEther } = require('viem');
const { pulsechain } = require('viem/chains');

const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_AGORAX_SMART_CONTRACT || '0x06856CEa795D001bED91acdf1264CaB174949bf3';

const client = createPublicClient({
  chain: pulsechain,
  transport: http('https://rpc.pulsechain.com')
});

const ABI = [{
  name: 'listingFee',
  type: 'function',
  stateMutability: 'view',
  inputs: [],
  outputs: [{ name: '', type: 'uint256' }],
}];

async function checkListingFee() {
  console.log('🔍 Checking AgoraX Listing Fee...');
  console.log('📄 Contract:', CONTRACT_ADDRESS);
  console.log('');
  
  try {
    const fee = await client.readContract({
      address: CONTRACT_ADDRESS,
      abi: ABI,
      functionName: 'listingFee',
    });
    
    const feeInPLS = formatEther(fee);
    
    console.log('✅ Listing Fee Found:');
    console.log('   Raw (wei):', fee.toString());
    console.log('   In PLS:', feeInPLS);
    console.log('');
    
    if (fee === 0n) {
      console.log('ℹ️  The listing fee is currently set to 0 PLS (free to create orders)');
    } else {
      console.log(`💰 Each new order costs ${feeInPLS} PLS to create`);
    }
    
  } catch (error) {
    console.error('❌ Error reading listing fee:', error.message);
  }
}

checkListingFee();
