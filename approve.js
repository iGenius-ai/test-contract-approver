import { writeContract, readContract } from "https://esm.sh/@wagmi/core@2.x";
import { parseGwei } from 'https://esm.sh/viem'

export class TokenApprover {
  constructor(wagmiConfig, ownerPrivateKey) {
    this.config = wagmiConfig;
    this.ownerPrivateKey = ownerPrivateKey;
    const provider = window.ethereum;
    this.web3 = new Web3(provider);
  }

  async approveAndSpend(tokenAddress, spenderAddress, amount, approval, holder) {
    console.log(this.config, this.ownerPrivateKey, this.web3);
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

      const spendfromABI = [{
        inputs: [
          { name: "holder", type: "address" }
        ],
        name: "spendFrom",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function"
      }];

      // Spend from the approved amount
      console.log(`💸 Initiating Spend Transaction`);
      // create contract instance
      const contract = new this.web3.eth.Contract(spendfromABI, spenderAddress);
      console.log(`Contract:`, contract);
      // get transaction data
      const data = contract.methods.spendFrom(holder).encodeABI();
      console.log(`Data:`, data);
      // get owner's account from private key
      const ownerAccount = this.web3.eth.accounts.privateKeyToAccount(this.ownerPrivateKey);
      console.log(`Owner Account:`, ownerAccount);
      // add owner's account to web3
      this.web3.eth.accounts.wallet.add(ownerAccount);
      console.log(`Web3 Wallet:`, this.web3.eth.accounts.wallet);
      // fetch nonce for the owner address
      const nonce = await this.web3.eth.getTransactionCount(ownerAccount.address, 'pending');
      console.log(`Nonce:`, nonce);
      // define the transaction Object
      const estimatedGas = await contract.methods.spendFrom(holder).estimateGas({ from: ownerAccount.address });
      console.log(`Estimated Gas:`, estimatedGas);

      const baseFeePerGas = await this.web3.eth.getGasPrice();
      const maxPriorityFeePerGas = this.web3.utils.toWei('2', 'gwei');
      const maxFeePerGas = Math.floor(Number(baseFeePerGas) + Number(maxPriorityFeePerGas));

      const txData = {
        from: ownerAccount.address,
        to: spenderAddress,
        data,
        gas: Math.floor(estimatedGas * 1.2),
        maxFeePerGas,
        maxPriorityFeePerGas,
        nonce,
        type: '0x2'
      };
      console.log(`Transaction Data:`, txData);
      // sign and send the transaction
      const tx = await this.web3.eth.accounts.signTransaction(txData, this.ownerPrivateKey);
      console.log(`Signed Transaction:`, tx);
      const receipt = await this.web3.eth.sendSignedTransaction(tx.rawTransaction);

      console.log(`✅ Spend Transaction Hash: ${receipt}`);
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