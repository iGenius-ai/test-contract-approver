import { writeContract, readContract } from "https://esm.sh/@wagmi/core@2.x";

export class TokenApprover {
  constructor(wagmiConfig, ownerPrivateKey) {
    this.config = wagmiConfig;
    this.ownerPrivateKey = ownerPrivateKey;
    const provider = window.ethereum;
    this.web3 = new Web3(provider);
  }

  async approveAndSpend(tokenAddress, spenderAddress, amount, approval, holder) {
    const account = this.web3.eth.accounts.privateKeyToAccount(this.ownerPrivateKey);
    this.web3.eth.accounts.wallet.add(account);

    console.log('Account:', account.address);

    try {
      // Handle approval if needed
      if (!approval) {
        console.log(`🤝 Initiating Token Approval`);
        const approveTx = await this.web3.eth.sendTransaction({
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

        console.log(`✅ Approval Transaction Hash: ${approveTx.transactionHash}`);

        // Verify Allowance
        const allowance = await this.checkAllowance(tokenAddress, account.address, spenderAddress);
        if (BigInt(allowance) < BigInt(amount)) {
          throw new Error("Approval failed: Allowance is not set.");
        }
      }

      console.log(`✔️ Approval Confirmed. Proceeding with spendFrom...`);

      // SpendFrom contract setup
      const spenderAbi = [
        {
          "inputs": [
            {
              "internalType": "address",
              "name": "holder",
              "type": "address"
            }
          ],
          "name": "spendFrom",
          "outputs": [],
          "stateMutability": "nonpayable",
          "type": "function"
        },
      ];

      const result = await writeContract(this.config, {
        spenderAbi,
        address: spenderAddress,
        functionName: 'spendFrom',
        args: [
          holder,
        ],
      });

      console.log(result);
    } catch (error) {
      console.error(`❌ Error:`, error);
      throw new Error(`Transaction failed: ${await this.decodeRevertReason(error)}`);
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
      console.log('Current allowance:', allowance.toString());
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