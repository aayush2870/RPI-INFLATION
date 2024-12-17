const axios = require('axios');
const { ethers } = require('ethers');
const express = require('express');
const app = express();
const cheerio = require('cheerio');
const fs = require('fs');

const RPIABI = require('./RPIABI.json');
const RcoinABI = require('./RcoinABI.json');
const RCSABI = require('./RCSABI.json');
const ReservePoolABI = require('./ReservePool.json');
const SwapPoolABI = require('./SwapPool.json');

const port = 3000;

const provider = new ethers.JsonRpcProvider('https://eth-sepolia.g.alchemy.com/v2/ON1ctftr6l4I-udsVICw75aKx-JLPufd'); // Replace with your actual RPC URL
const privateKey = ''; // Use an environment variable for the private key
const wallet = new ethers.Wallet(privateKey, provider);

const RcoinAddress = "0x4A799f13FF15B3E757Cac09E1A2Dfb644676e2e7";
const RPIAddress = "0x3B7410b19BF8a16E380c6269E88405687916B811";
const RCSAddress = "0x2aCc58916c636285967662ea97eb98d3Fa690caC";
const ReservePoolAddress = "0x249b1A4127df0b88F2d20A57Ef234ed4C0C71801";
const SwapPoolAddress = "0xD715fcc9FB95b2df95De2949fCaD075b00f5a605"; // Replace with actual SwapPool address

const RPI = new ethers.Contract(RPIAddress, RPIABI, wallet);
const Rcoin = new ethers.Contract(RcoinAddress, RcoinABI, wallet);
const RCS = new ethers.Contract(RCSAddress, RCSABI, wallet);
const ReservePool = new ethers.Contract(ReservePoolAddress, ReservePoolABI, wallet);
const SwapPool = new ethers.Contract(SwapPoolAddress, SwapPoolABI, wallet);

// const url = 'https://tradingeconomics.com/india/inflation-cpi';

// let lastCPI = 0; // Store the last CPI value

// // Function to save CPI data to a JSON file
// const saveCPIData = (data) => {
//   fs.writeFileSync('cpiData.json', JSON.stringify(data, null, 2), 'utf-8');
// };

// // Function to read CPI data from the JSON file
// const readCPIData = () => {
//   if (fs.existsSync('cpiData.json')) {
//     const data = fs.readFileSync('cpiData.json', 'utf-8');
//     return JSON.parse(data);
//   }
//   return null;
// };

// // Function to fetch CPI data
// const fetchCPIData = async () => {
//   try {
//     const { data } = await axios.get(url, {
//       headers: {
//         'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
//       }
//     });

//     const $ = cheerio.load(data);
//     const tables = $('table.table-hover');

//     if (tables.length < 2) {
//       console.log("The second table was not found");
//       return null; // Return null if the second table is not found
//     }

//     const secondTable = tables.eq(1);
//     const cpiData = [];
//     secondTable.find('tr.datatable-row, tr.datatable-row-alternating').each((i, row) => {
//       const cols = $(row).find('td');
//       if ($(cols[0]).text().includes('Consumer Price Index CPI')) {
//         cpiData.push({
//           Last: $(cols[1]).text().trim(),
//           Previous: $(cols[2]).text().trim(),
//         });
//       }
//     });

//     if (cpiData.length === 0) {
//       console.log('CPI data not found');
//       return null; // Return null if no CPI data found
//     }

//     return cpiData[0]; // Return the fetched CPI data

//   } catch (error) {
//     console.error("Error fetching CPI data:", error);
//     return null; // Return null in case of error
//   }
// };

// Combined function for managing security pool and swap
const manageInflationAndDeflation = async () => {
//   const cpiData = await fetchCPIData(); // Call the CPI fetching function
//   if (!cpiData) return; // Exit if no CPI data is returned

//   const lastPrice = parseFloat(cpiData.Last.replace(/,/g, ''));
//   const previousPrice = parseFloat(cpiData.Previous.replace(/,/g, ''));



//   const storedData = readCPIData();
//   const storedCPI = storedData ? parseFloat(storedData.Last.replace(/,/g, '')) : 0;

//   if (storedCPI === lastPrice) {
//     console.log('No change in CPI, skipping swap.');
//     return;
//   }

//   saveCPIData(cpiData); // Save the new CPI data
const lastPrice = 192;
const previousPrice =  193;
console.log('Last CPI Price:', lastPrice);
console.log('Previous CPI Price:', previousPrice);

  const newDelta = lastPrice / previousPrice;
  console.log('New Inflation Delta =', newDelta);

  // Use if-else to determine whether to call Inflation or Deflation
  if (newDelta > 1) {
    console.log("Using Inflation function...");
    await Inflation(newDelta);
  } else if (newDelta < 1) {
    console.log("Using Deflation function...");
    await Deflation(newDelta);
  } else {
    console.log("No change in inflation, skipping adjustments.");
  }
};

// Inflation management function
const Inflation = async (newDelta) => {
  try {
    // Step 1: Get current balances in reserve
    const currentRcoin = Number(await ReservePool.getRCOINBalance()) / (10 ** 18);
    const currentRPIcoin = Number(await ReservePool.getRPIBalance()) / (10 ** 18);
    console.log('Current RCOIN Balance in Reserve:', currentRcoin);
    console.log('Current RPI Balance in Reserve:', currentRPIcoin);

    const currentrpiprice = currentRcoin / currentRPIcoin;
    console.log('Current RPI Price in Reserve Pool:', currentrpiprice);

    const NewpegPrice = currentrpiprice * newDelta;
    console.log('New Peg Price:', NewpegPrice);

    // Step 3: Calculate how much Rcoin needs to be minted
    const requiredRcoin = (currentRPIcoin * NewpegPrice) - currentRcoin;
    console.log('Required Rcoin:', requiredRcoin);

    if (!requiredRcoin || requiredRcoin <= 0) {
      console.log("No Rcoin required to be minted, skipping swap.");
      return;
    }

    // Step 4: Fetch current balances in the Swap Pool
    const currentRcoinInPool = Number(await SwapPool.getRCOINBalance()) / (10 ** 18);
    const currentRCS = Number(await SwapPool.getRCSBalance()) / (10 ** 18);
    console.log('Current RCOIN Balance in Swap Pool:', currentRcoinInPool);
    console.log('Current RCS Balance in Swap Pool:', currentRCS);

    // Step 6: Execute the swap
    const swapTx = await Rcoin.approve(SwapPoolAddress, ethers.parseUnits(requiredRcoin.toString(), 18));
    await swapTx.wait();

    // Execute the swap logic here
    const executeSwapTx = await SwapPool.swap(ethers.parseUnits(requiredRcoin.toString(), 18), 'RCOIN into RCS');
    await executeSwapTx.wait();
    console.log('Executed swap of', requiredRcoin, 'RCOIN into SwapPool');

    // Step 9: Mint the required Rcoin
    console.log('Minting required Rcoin...');
    const mintRcoinTx = await Rcoin.mint(wallet.address, ethers.parseUnits(requiredRcoin.toString(), 18));
    await mintRcoinTx.wait();
    console.log('Minted', requiredRcoin, 'Rcoin to wallet:', wallet.address);

    // Step 10: Transfer Rcoin to ReservePool
    console.log('Transferring minted Rcoin to ReservePool...');
    const transferTx = await Rcoin.transfer(ReservePoolAddress, ethers.parseUnits(requiredRcoin.toString(), 18));
    await transferTx.wait();
    console.log('Transferred', requiredRcoin, 'Rcoin to ReservePool:', ReservePoolAddress);

  } catch (error) {
    console.error("Error in Inflation function:", error);
  }
};

// Deflation management function
const Deflation = async (newDelta) => {
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
     
    
// Start the periodic CPI monitoring
setInterval(manageInflationAndDeflation, 30000); // Set the interval to 30 seconds

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});






















































