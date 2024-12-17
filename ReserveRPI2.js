const { ethers } = require('ethers');
const express = require('express');
const app = express();

// ABI files for interacting with contracts
const RPIABI = require('./RPIABI.json');
const RcoinABI = require('./RcoinABI.json');
const RCSABI = require('./RCSABI.json');
const ReservePoolABI = require('./ReservePool.json');
const SwapPoolABI = require('./SwapPool.json');

// Provider and wallet setup
const provider = new ethers.JsonRpcProvider('https://eth-sepolia.g.alchemy.com/v2/ON1ctftr6l4I-udsVICw75aKx-JLPufd');
const privateKey = '';
const wallet = new ethers.Wallet(privateKey, provider);

// Contract addresses
const RcoinAddress = "0x4A799f13FF15B3E757Cac09E1A2Dfb644676e2e7";
const RPIAddress = "0x3B7410b19BF8a16E380c6269E88405687916B811";
const RCSAddress = "0x2aCc58916c636285967662ea97eb98d3Fa690caC";
const ReservePoolAddress = "0x249b1A4127df0b88F2d20A57Ef234ed4C0C71801";
const SwapPoolAddress = "0xD715fcc9FB95b2df95De2949fCaD075b00f5a605";

// Contract instances
const Rcoin = new ethers.Contract(RcoinAddress, RcoinABI, wallet);
const RCS = new ethers.Contract(RCSAddress, RCSABI, wallet);
const ReservePool = new ethers.Contract(ReservePoolAddress, ReservePoolABI, wallet);
const SwapPool = new ethers.Contract(SwapPoolAddress, SwapPoolABI, wallet);

// Hardcoded delta value
const newDelta = 0.9948186528497409;

async function handleDeltaLessThanOne(newDelta) {
  try {
   // Get current balances in reserve
   const currentRcoin = Number(await ReservePool.getRCOINBalance()) / (10 ** 18);
   const currentRPIcoin = Number(await ReservePool.getRPIBalance()) / (10 ** 18);
   console.log('Current RCOIN Balance in Reserve:', currentRcoin);
   console.log('Current RPI Balance in Reserve:', currentRPIcoin);
   
    // Calculate the excess RCOIN amount based on delta
    const currentrpiprice = currentRcoin / currentRPIcoin;
    console.log('Current RPI Price in Reserve Pool:', currentrpiprice);
    
    const NewpegPrice = currentrpiprice * newDelta;
    console.log('New Peg Price:', NewpegPrice);
    
    // Calculate how much Rcoin needs to be move from the reservepool
    const excessRcoin =  currentRcoin-(currentRPIcoin * NewpegPrice) ;
    console.log('Excess Rcoin to remove from ReservePool', excessRcoin);

    // Withdraw excess RCOIN from Reserve Pool
    const withdrawTx = await ReservePool.withdrawRCOIN(ethers.parseUnits(excessRcoin.toString(), 18));
    await withdrawTx.wait();
    console.log(`Withdrawn RCOIN from Reserve Pool`,excessRcoin);

    // Fetch current balances in the Swap Pool
    const currentRcoinInPool = Number(await SwapPool.getRCOINBalance()) / (10 ** 18);
    const currentRCS = Number(await SwapPool.getRCSBalance()) / (10 ** 18);
    console.log('Current RCOIN Balance in swap pool:', currentRcoinInPool);
    console.log('Current RCS Balance in Swap pool:', currentRCS);
   

    // Calculate the price of RCS in the Swap Pool using normal arithmetic
    const currentRcsPriceInPool = currentRcoinInPool / currentRCS; // Use direct division
    console.log('Price of RCS in Swap pool:', currentRcsPriceInPool);
    // Deposit the withdrawn RCOIN into the Swap Pool to acquire RCS
    const depositTx = await SwapPool.depositRCOIN( ethers.parseUnits(excessRcoin.toString(), 18));
    await depositTx.wait();
    console.log('RCOIN deposited into Swap Pool to buy RCS.',excessRcoin);
    
    // Calculate how much RCS can be withdrawn based on the deposited RCOIN
    const rcsToWithdraw = excessRcoin / currentRcsPriceInPool; // Use direct division

// Withdraw the calculated RCS tokens to your wallet
    const withdrawRcsTx = await SwapPool.withdrawRCS(ethers.parseUnits(rcsToWithdraw.toString(), 18));
    await withdrawRcsTx.wait();
    console.log(`Withdrawn RCS from Swap Pool to your wallet.`,rcsToWithdraw);

    // Optionally, check updated balances in the pool
    const updatedRcoinInPool = Number(await SwapPool.getRCOINBalance()) / (10 ** 18);
    const updatedRCS = Number(await SwapPool.getRCSBalance()) / (10 ** 18);
    console.log('Updated RCOIN Balance in swap pool:', updatedRcoinInPool);
    console.log('Updated RCS Balance in Swap pool:', updatedRCS);

  } catch (error) {
    console.error('Error in handling delta < 1:', error);
  }
  try {
    // Fetch the current RCS balance in your wallet
    const currentRcsBalance = await RCS.balanceOf(wallet.address);
    console.log('Current RCS Balance in Wallet:', currentRcsBalance);

    if (currentRcsBalance > 0) {
      
    
    const deadWalletAddress = '0x000000000000000000000000000000000000dEaD'; // Dead wallet address

    // Transfer all RCS to the dead wallet
    const transferTx = await RCS.transfer(deadWalletAddress,currentRcsBalance);
    await transferTx.wait();
    console.log(`Successfully transferred  RCS to the dead wallet.`,currentRcsBalance);
  }
  } catch (error) {
    console.error('Error depositing RCS to dead wallet:', error);
  }
}


// Main logic to check delta and take action
async function SecurityPool(newDelta) {
  try {
    if (newDelta < 1) {
      console.log('Delta is less than 1, taking action...');
      await handleDeltaLessThanOne(newDelta);
    } else {
      console.log('Delta is greater than or equal to 1, no action required.');
    }
  } catch (error) {
    console.error('Error in Security Pool logic:', error);
  }
}

// Call the SecurityPool function with the hardcoded delta
SecurityPool(newDelta);
