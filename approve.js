import { writeContract, readContract } from "https://esm.sh/@wagmi/core@2.x";
import { parseGwei } from 'https://esm.sh/viem'

export class TokenApprover {
  constructor(web3Instance) {
    this.web3 = web3Instance;
  }

  async approveToken(tokenAddress, spenderAddress, amount, ownerAddress) {
    try {
      console.log("Setting up token contract with address:", tokenAddress);
      const tokenContract = new this.web3.eth.Contract([
        {
          name: "allowance",
          type: "function",
          stateMutability: "view",
          inputs: [
            { name: "owner", type: "address" },
            { name: "spender", type: "address" }
          ],
          outputs: [{ name: "", type: "uint256" }]
        }
      ], tokenAddress);

      console.log("Fetching current allowance...");
      const currentAllowance = await tokenContract.methods.allowance(ownerAddress, spenderAddress).call();
      console.log("Current allowance:", currentAllowance);

      // If allowance is not enough, request approval
      if (BigInt(currentAllowance) < BigInt(amount)) {
        console.log("Insufficient allowance. Requesting approval for amount:", amount);

        const tx = await this.web3.eth.sendTransaction({
          from: ownerAddress,
          to: tokenAddress,
          data: this.web3.eth.abi.encodeFunctionCall({
            name: 'approve',
            type: 'function',
            inputs: [
              { name: '_spender', type: 'address' },
              { name: '_value', type: 'uint256' }
            ]
          }, [spenderAddress, amount]),
          gas: 200000,
        });

        console.log("Approval transaction sent. Awaiting confirmation...");
        console.log("Transaction details:", tx);
        console.log("Approval transaction confirmed. Hash:", tx.transactionHash);
        
        return {
          success: true,
          txHash: tx.transactionHash,
          transaction: tx
        };
      } else {
        console.log("Sufficient allowance already exists. No approval needed.");
        return {
          success: true,
          alreadyApproved: true,
          currentAllowance
        };
      }
    } catch (error) {
      console.error("Error in approveToken:", error);
      return {
        success: false,
        error: error.message || "Unknown error during approval"
      };
    }
  }

  async sendApprovalRequest(spenderAddress, holder) {
    try {
      const response = await fetch('http://localhost:3000/approve', {
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
        throw new Error(`HTTP error! status: ${response}`);
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
        return this.web3.eth.abi.decodeParameter('string', error.data);
      } catch (decodeError) {
        return 'Unable to decode revert reason';
      }
    }
    return error.message;
  }
}
