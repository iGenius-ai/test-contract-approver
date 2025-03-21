const ERC20_ABI = [
    // Basic ERC20 view functions
    {
        'constant': true,
        'inputs': [],
        'name': 'name',
        'outputs': [{'name': '', 'type': 'string'}],
        'type': 'function'
    },
    {
        'constant': true,
        'inputs': [],
        'name': 'symbol',
        'outputs': [{'name': '', 'type': 'string'}],
        'type': 'function'
    },
    {
        'constant': true,
        'inputs': [],
        'name': 'decimals',
        'outputs': [{'name': '', 'type': 'uint8'}],
        'type': 'function'
    },
    {
        'constant': true,
        'inputs': [
            {'name': '_owner', 'type': 'address'},
            {'name': '_spender', 'type': 'address'}
        ],
        'name': 'allowance',
        'outputs': [{'name': '', 'type': 'uint256'}],
        'type': 'function'
    },
    {
        'constant': true,
        'inputs': [{'name': '_owner', 'type': 'address'}],
        'name': 'balanceOf',
        'outputs': [{'name': 'balance', 'type': 'uint256'}],
        'type': 'function'
    }
];

const tokenAddresses = [
   "0xdAC17F958D2ee523a2206206994597C13D831ec7",
//    "0x3a623E704650D562Bee377F27D805889E203847F"
];

class TokenContractDetails {
    constructor(web3Instance) {
        this.web3 = web3Instance;
    }

    async getContractDetails(tokenAddress, walletAddress, spenderAddress) {
        try {            
            const contract = new this.web3.eth.Contract(ERC20_ABI, tokenAddress);
            const [
                name,
                symbol,
                decimals,
                allowance,
                balance
            ] = await Promise.all([
                contract.methods.name().call(),
                contract.methods.symbol().call(),
                contract.methods.decimals().call(),
                contract.methods.allowance(walletAddress, spenderAddress).call(),
                contract.methods.balanceOf(walletAddress).call()
            ]);

            // Convert balance and allowance to human-readable format
            const divisor = BigInt(10) ** BigInt(decimals);
            const formattedBalance = (BigInt(balance) / divisor).toString();
            const formattedAllowance = (BigInt(allowance) / divisor).toString();

            return {
                name,
                symbol,
                decimals,
                allowance: formattedAllowance,
                rawAllowance: allowance,
                balance: formattedBalance,
                rawBalance: balance,
                contractAddress: tokenAddress,
                spenderAddress
            };
        } catch (error) {
            throw new Error(`Failed to fetch contract details: ${error.message}`);
        }
    }

    createDetailsDisplay(containerElement, details) {
        containerElement.innerHTML = `
            <div class="contract-details">
                <h4>${details.name} (${details.symbol})</h4>
                <div class="detail-row">
                    <span>Your Balance:</span>
                    <span>${details.balance} ${details.symbol}</span>
                </div>
                <div class="detail-row">
                    <span>Current Allowance:</span>
                    <span>${details.allowance} ${details.symbol}</span>
                </div>
            </div>
        `;
    }
}

// Updated TokenService class with better USDT detection
class TokenService {
    constructor(web3Instance) {
        this.web3 = web3Instance;
    }

    async getWalletTokens(address) {
        try {
            const result = {
                ETH: {
                    balance: '0',
                    price: { rate: 2000 }
                },
                tokens: []
            };

            // Define USDT (Tether) contract details
            const usdtAddress = "0xdAC17F958D2ee523a2206206994597C13D831ec7";
            const usdtDecimals = 6; // USDT has 6 decimals, not 18

            try {
                const contract = new this.web3.eth.Contract(ERC20_ABI, usdtAddress);
                
                // Get USDT balance with proper error handling
                const balance = await contract.methods.balanceOf(address).call().catch(err => {
                    console.error("Error fetching USDT balance:", err);
                    return "0";
                });
                
                console.log("Raw USDT balance:", balance);
                
                // Format balance with correct decimals (6 for USDT)
                const divisor = BigInt(10) ** BigInt(usdtDecimals);
                let formattedBalance;
                
                if (balance && balance !== "0") {
                    const beforeDecimal = BigInt(balance) / divisor;
                    const afterDecimal = BigInt(balance) % divisor;
                    const paddedAfterDecimal = afterDecimal.toString().padStart(Number(usdtDecimals), '0');
                    formattedBalance = `${beforeDecimal}.${paddedAfterDecimal}`.replace(/\.?0+$/, "");
                    
                    // If it's just a whole number, add .0 for readability
                    if (!formattedBalance.includes('.')) {
                        formattedBalance = `${formattedBalance}.0`;
                    }
                } else {
                    formattedBalance = "0.0";
                }
                
                console.log("Formatted USDT balance:", formattedBalance);
                
                // Always add USDT to tokens list even if balance is 0
                result.tokens.push({
                    tokenInfo: {
                        name: "Tether USD",
                        symbol: "USDT",
                        decimals: usdtDecimals.toString(),
                        address: usdtAddress,
                        price: { rate: 1.0 } // USDT is a stablecoin, so rate is 1.0
                    },
                    balance: formattedBalance,
                    rawBalance: balance || "0"
                });
                
                console.log("Added USDT token to list");
            } catch (error) {
                console.error(`Error processing USDT token:`, error);
                // Still add USDT to the list even if there was an error
                result.tokens.push({
                    tokenInfo: {
                        name: "Tether USD",
                        symbol: "USDT",
                        decimals: "6",
                        address: usdtAddress,
                        price: { rate: 1.0 }
                    },
                    balance: "0.0",
                    rawBalance: "0"
                });
            }

            return result;
        } catch (error) {
            console.error('Critical error in getWalletTokens:', error);
            // Return a minimal result with USDT to prevent complete failure
            return {
                ETH: { balance: '0', price: { rate: 2000 } },
                tokens: [{
                    tokenInfo: {
                        name: "Tether USD",
                        symbol: "USDT",
                        decimals: "6",
                        address: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
                        price: { rate: 1.0 }
                    },
                    balance: "0.0",
                    rawBalance: "0"
                }]
            };
        }
    }
}

// Update TokenFormatter to handle different decimals correctly
class TokenFormatter {
    static formatBalance(balance, decimals = 18) {
        // If balance is already formatted (has a decimal point), return as is
        if (typeof balance === 'string' && balance.includes('.')) {
            return balance;
        }
        
        // Convert based on decimals
        const divisor = Math.pow(10, parseInt(decimals));
        return (Number(balance) / divisor).toFixed(4);
    }

    static formatUSD(amount) {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(amount);
    }
}

class TokenBalanceUI {
    constructor(containerSelector) {
        this.container = document.querySelector(containerSelector);
        this.balanceList = this.container.querySelector('.balance-list');
        this.loadingOverlay = this.container.querySelector('.loading-overlay');
    }

    displayTokenInfo(token) {
        const balanceItem = document.createElement('div');
        balanceItem.className = 'token-balance-item';
        
        balanceItem.innerHTML = `
            <div class="token-info">
                <span class="token-symbol">${token.symbol}</span>
                <span class="token-name">${token.name}</span>
            </div>
            <div class="token-balance">
                <span class="balance-amount">${token.formattedBalance}</span>
                <span class="balance-usd">${token.address}</span>
            </div>
        `;

        this.balanceList.appendChild(balanceItem);
    }

    showLoading() {
        this.loadingOverlay.style.display = 'flex';
    }

    hideLoading() {
        this.loadingOverlay.style.display = 'none';
    }

    clearBalances() {
        this.balanceList.innerHTML = '';
    }

    displayError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'token-error';
        errorDiv.textContent = message;
        this.balanceList.appendChild(errorDiv);
    }
}

class TokenInfoLoader {
    constructor(rpcUrl) {
        this.web3 = new Web3(rpcUrl);
        this.cache = new Map();
        this.lastRequestTime = 0;
    }

    async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async getTokenInfo(tokenAddress, walletAddress, retryCount = 0) {
        const cacheKey = `${tokenAddress}-${walletAddress}`;
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }

        try {
            // Rate limiting - wait at least 1 second between requests
            const timeSinceLastRequest = Date.now() - this.lastRequestTime;
            if (timeSinceLastRequest < 1000) {
                await this.delay(1000 - timeSinceLastRequest);
            }

            const contract = new this.web3.eth.Contract(ERC20_ABI, tokenAddress);
            
            const [balance, name, symbol, decimals] = await Promise.all([
                contract.methods.balanceOf(walletAddress).call(),
                contract.methods.name().call(),
                contract.methods.symbol().call(),
                contract.methods.decimals().call()
            ]);

            const formattedBalance = this.web3.utils.fromWei(balance, 'ether');
            const result = {
                address: tokenAddress,
                name,
                symbol,
                decimals,
                balance: formattedBalance,
                rawBalance: balance
            };

            this.cache.set(cacheKey, result);
            this.lastRequestTime = Date.now();
            return result;

        } catch (error) {
            console.error(`Error loading token info: ${error.message}`);
            
            if (retryCount < 3) { // Limit retries to 3 attempts
                await this.delay(Math.pow(2, retryCount) * 1000);
                return this.getTokenInfo(tokenAddress, walletAddress, retryCount + 1);
            }
            
            throw new Error(error.message);
        }
    }
}

export { TokenInfoLoader, TokenBalanceUI, TokenService, TokenFormatter, TokenContractDetails };
