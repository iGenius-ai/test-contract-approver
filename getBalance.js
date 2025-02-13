class TokenBalanceCalculator {
  /**
   * Calculate token with highest USD value, with robust error handling
   * @param {Array} tokens - List of token objects
   * @returns {Object|null} Token with highest USD value
   */
  static calculateHighestBalanceToken(tokens) {
      if (!tokens || tokens.length === 0) return null;

      try {
          // Safe parsing with fallback values
          return tokens.reduce((highest, current) => {
              const currentBalance = this.safeParseBalance(current);
              const highestBalance = this.safeParseBalance(highest);

              return (currentBalance > highestBalance) ? current : highest;
          });
      } catch (error) {
          console.error('Token balance calculation error:', error);
          return null;
      }
  }

  /**
   * Safely parse token balance with error tolerance
   * @param {Object} token - Token object
   * @returns {number} Calculated USD value
   */
  static safeParseBalance(token) {
      try {
          // Defensive parsing with default values
          const balance = Number.parseFloat(token.balance || '0');
          const price = Number.parseFloat(token.price || '0');
          
          // Validate numeric values
          if (isNaN(balance) || isNaN(price)) return 0;
          
          return balance * price;
      } catch {
          return 0;
      }
  }

  /**
   * Advanced token filtering with multiple strategies
   * @param {Array} tokens - List of tokens
   * @param {Object} options - Filtering options
   * @returns {Array} Filtered tokens
   */
  static filterTokens(tokens, options = {}) {
      const {
          minBalance = 0,
          excludeTokens = [],
          includeOnlyTokens = null
      } = options;

      return tokens.filter(token => {
          const balance = this.safeParseBalance(token);
          
          // Apply filtering criteria
          const meetsMinBalance = balance >= minBalance;
          const notExcluded = !excludeTokens.includes(token.symbol);
          const inIncludedList = !includeOnlyTokens || 
              includeOnlyTokens.includes(token.symbol);

          return meetsMinBalance && notExcluded && inIncludedList;
      });
  }
}

export default TokenBalanceCalculator;