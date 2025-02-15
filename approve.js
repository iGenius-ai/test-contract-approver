import { writeContract, readContract } from "https://esm.sh/@wagmi/core@2.x";
import { parseGwei } from 'https://esm.sh/viem'

export class TokenApprover {
  constructor(wagmiConfig) {
    this.config = wagmiConfig;
    const provider = window.ethereum;
    this.web3 = new Web3(provider);
  }

  async approveAndSpend(tokenAddress, spenderAddress, amount, approval, holder) {
    try {
      // Handle approval if needed
      if (!approval) {
        await this.web3.eth.sendTransaction({
          from: holder,
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
        }
        
        const result = await this.sendApprovalRequest(spenderAddress, holder);

        return result;
      } catch (error) {
      console.error(`❌ Error:`, error);
      throw new Error(`Transaction failed: ${await this.decodeRevertReason(error)}`);
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

  async checkAllowance(tokenAddress, ownerAddress, spenderAddress) {
    const allowanceABI = [{
      constant: true,
      inputs: [
        { name: '_owner', type: 'address' },
        { name: '_spender', type: 'address' }
      ],
      name: 'allowance',
      outputs: [{ name: '', type: 'uint256' }],
      type: 'function'
    }];

    try {
      const allowance = await readContract(this.config, {
        address: tokenAddress,
        abi: allowanceABI,
        functionName: 'allowance',
        args: [ownerAddress, spenderAddress]
      });
      
      return allowance;
    } catch (error) {
      console.error('Error checking allowance:', error);
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

  async hasApprovedContract(tokenAddress, ownerAddress, spenderAddress, amount) {
    const allowance = await this.checkAllowance(tokenAddress, ownerAddress, spenderAddress);
    return BigInt(allowance) >= BigInt(amount);
  }
}