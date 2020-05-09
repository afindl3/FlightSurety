
var HDWalletProvider = require("truffle-hdwallet-provider");
var mnemonic = "candy maple cake sugar pudding cream honey rich smooth crumble sweet treat";

module.exports = {
  networks: {
    development: {
      host: "127.0.0.1",
      port: 8545,
      network_id: '*',
      gas: 9999999
    },
  //   development: {
  //     provider: function() {
  //       return new HDWalletProvider(mnemonic, "http://127.0.0.1:8545/", 0, 50);
  //     },
  //     network_id: '*',
  //     gas: 9999999
  //   }
  // AF - It appears that HDWalletProvider has an issue - the old configuration was throwing:
  //    Error: the tx doesn’t have the correct nonce. account has nonce of
  // When running the 'can request flight status' unit test it oracles.js
  // Full explanation can be found at: https://knowledge.udacity.com/questions/38069
  },
  compilers: {
    solc: {
      version: "^0.4.24"
    }
  }
};