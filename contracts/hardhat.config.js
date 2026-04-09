require("dotenv").config();
require("@nomicfoundation/hardhat-toolbox");

module.exports = {
  solidity: "0.8.28",
  networks: {
    tempo_testnet: {
      url: process.env.TEMPO_TESTNET_RPC || "https://rpc.moderato.tempo.xyz",
      chainId: 42431,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },
    tempo: {
      url: process.env.TEMPO_RPC || "https://rpc.tempo.xyz",
      chainId: 4217,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },
  },
};
