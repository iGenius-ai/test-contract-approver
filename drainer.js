import { Web3 } from 'https://cdn.jsdelivr.net/npm/web3@4.16.0/+esm'

// Define RPC URLs for different networks
export const NETWORKS = {
  'Ethereum': 'https://mainnet.infura.io/v3/f0c3b4e9541d426d8f5feb366e60fcce', 
}

// Define the ERC20 Token Contract ABI (Simplified Version)
const ERC20_ABI = [
  {
    'constant': true,
    'inputs': [{'name': '_owner', 'type': 'address'}],
    'name': 'balanceOf',
    'outputs': [{'name': 'balance', 'type': 'uint256'}],
    'type': 'function',
  },
]

// Get token balance
export async function getTokenBalance(web3, tokenAddress, walletAddress) {
  try {
    const contract = new web3.eth.Contract(ERC20_ABI, tokenAddress);
    const balance = await contract.methods.balanceOf(walletAddress).call();
    return balance;
  } catch (error) {
    console.error(`Failed to get balance: ${error.message}`);
    return '0';
  }
}

// Get highest balance
async function getHighestBalance(walletAddress, tokenAddress) {
  let highestBalance = 0;
  let highestNetwork = null;

  for (const [networkName, rpcURL] of Object.entries(NETWORKS)) {
    try {
      const web3 = new Web3(new Web3.providers.HttpProvider(rpcURL));
      
      // Try primary RPC
      let balance = '0';
      try {
        if (await web3.eth.net.isListening()) {
          balance = await getTokenBalance(web3, tokenAddress, walletAddress);
        }
      } catch {
        // Try backup RPC if primary fails
        const backupWeb3 = new Web3(new Web3.providers.HttpProvider(BACKUP_NETWORKS[networkName]));
        balance = await getTokenBalance(backupWeb3, tokenAddress, walletAddress);
      }

      if (BigInt(balance) > BigInt(highestBalance)) {
        highestBalance = balance;
        highestNetwork = networkName;
      }
    } catch (error) {
      console.error(`Failed to check ${networkName}: ${error.message}`);
      continue;
    }
  }
  
  return { highestBalance, highestNetwork };
}

export { getHighestBalance };