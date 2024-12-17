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

const provider = new ethers.JsonRpcProvider('########'); // Replace with your actual RPC URL
const privateKey = ''; // Replace with your actual private key
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

const url = 'https://tradingeconomics.com/india/inflation-cpi';

let lastCPI = 0; // Store the last CPI value

// Function to save CPI data to a JSON file
const saveCPIData = (data) => {
  fs.writeFileSync('cpiData.json', JSON.stringify(data, null, 2), 'utf-8');
};

// Function to read CPI data from the JSON file
const readCPIData = () => {
  if (fs.existsSync('cpiData.json')) {
    const data = fs.readFileSync('cpiData.json', 'utf-8');
    return JSON.parse(data);
  }
  return null;
};

// Function to fetch CPI and update if changed
const SecurityPool = async () => {
  try {
    // Fetch the webpage
    const { data } = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    // Load the HTML into cheerio
    const $ = cheerio.load(data);

    // Find all tables with the class 'table table-hover'
    const tables = $('table.table-hover');

    // Check if at least two tables are found
    if (tables.length < 2) {
      console.log("The second table was not found");
      return;
    }

    // Select the second table
    const secondTable = tables.eq(1);

    // Extract the data for Consumer Price Index (CPI)
    const cpiData = [];
    secondTable.find('tr.datatable-row, tr.datatable-row-alternating').each((i, row) => {
      const cols = $(row).find('td');
      if ($(cols[0]).text().includes('Consumer Price Index CPI')) {
        cpiData.push({
          Last: $(cols[1]).text().trim(),
          Previous: $(cols[2]).text().trim(),
        });
      }
    });

    // Check if CPI data is found
    if (cpiData.length === 0) {
      console.log('CPI data not found');
      return;
    }

    // Assign CPI data to lastPrice and previousPrice
    const lastPrice = parseFloat(cpiData[0].Last.replace(/,/g, '')); // Convert to number, handle commas if present
    const previousPrice = parseFloat(cpiData[0].Previous.replace(/,/g, ''));

    console.log('Last CPI Price:', lastPrice);
    console.log('Previous CPI Price:', previousPrice);

    // Read the last stored CPI data
    const storedData = readCPIData();
    const storedCPI = storedData ? parseFloat(storedData.Last.replace(/,/g, '')) : 0;

    // Compare last CPI with previous stored CPI value
    if (storedCPI === lastPrice) {
      console.log('No change in CPI, skipping swap.');
      return null; // Return null if no change in CPI
    }

    // Update lastCPI with new value and save to file
    lastCPI = lastPrice;
    saveCPIData(cpiData[0]); // Save the new CPI data

    // CPI values
    const newDelta = lastPrice / previousPrice;
    console.log('New Inflation Delta =', newDelta);

    // Get current balances in reserve
    const currentRcoin = Number(await ReservePool.getRCOINBalance()) / (10 ** 18);
    const currentRPIcoin = Number(await ReservePool.getRPIBalance()) / (10 ** 18);
    console.log('Current RCOIN Balance in Reserve:', currentRcoin);
    console.log('Current RPI Balance in Reserve:', currentRPIcoin);
    
    const currentrpiprice = currentRcoin / currentRPIcoin;
    console.log('Current RPI Price in Reserve Pool:', currentrpiprice);
    
    const NewpegPrice = currentrpiprice * newDelta;
    console.log('New Peg Price:', NewpegPrice);
    
    // Calculate how much Rcoin needs to be minted
    const requiredRcoin = (currentRPIcoin * NewpegPrice) - currentRcoin;
    console.log('Required Rcoin:', requiredRcoin);

    // Return requiredRcoin to be used in swap function
    return requiredRcoin;

  } catch (error) {
    console.error(`Error in SecurityPool: ${error.message}`);
  }
};

const swap = async (requiredRcoin) => {
  try {
    if (!requiredRcoin || requiredRcoin <= 0) {
      console.log("No Rcoin required to be minted, skipping swap.");
      return;
    }

    // Fetch current balances in the Swap Pool
    const currentRcoinInPool = Number(await SwapPool.getRCOINBalance()) / (10 ** 18);
    const currentRCS = Number(await SwapPool.getRCSBalance()) / (10 ** 18);
    console.log('Current RCOIN Balance in swap pool:', currentRcoinInPool);
    console.log('Current RCS Balance in Swap pool:', currentRCS);

    // Calculate the price of RCS in the Swap Pool
    const currentRcsPriceInPool = currentRcoinInPool / currentRCS;
    console.log('Price of RCS in Swap pool:', currentRcsPriceInPool);

    // Calculate the required amount of RCS to deposit for the equivalent Rcoin
    const RequiredRCSToMint = requiredRcoin / currentRcsPriceInPool;
    console.log('Amount of RCS to deposit:', RequiredRCSToMint);

    // Step 1: Mint the required RCS to your wallet
    console.log('Minting RCS to wallet...');
    const mintTx = await RCS.mint(wallet.address, ethers.parseUnits(RequiredRCSToMint.toString(), 18));
    await mintTx.wait();
    console.log('Minted', RequiredRCSToMint, 'RCS to wallet:', wallet.address);

    // Step 2: Approve SwapPool to spend the minted RCS
    console.log('Approving SwapPool to spend RCS...');
    const approveTx = await RCS.approve(SwapPoolAddress, ethers.parseUnits(RequiredRCSToMint.toString(), 18));
    await approveTx.wait();
    console.log('Approved SwapPool to spend', RequiredRCSToMint, 'RCS');

    // Step 3: Deposit RCS into the SwapPool
    console.log('Depositing RCS into SwapPool...');
    const depositTx = await SwapPool.depositRCS(ethers.parseUnits(RequiredRCSToMint.toString(), 18));
    await depositTx.wait();
    console.log('Deposited', RequiredRCSToMint, 'RCS into SwapPool');

    // Step 4: Calculate the equivalent amount of Rcoin and withdraw from SwapPool
    const withdrawnRcoin = RequiredRCSToMint * currentRcsPriceInPool; // Calculate the Rcoin amount
    console.log('Withdrawing', withdrawnRcoin, 'Rcoin from SwapPool...');

    const withdrawTx = await SwapPool.withdrawRCOIN(ethers.parseUnits(withdrawnRcoin.toString(), 18));
    await withdrawTx.wait();
    console.log('Withdrew', withdrawnRcoin, 'Rcoin to wallet');

    // Step 5: Transfer the withdrawn Rcoin from wallet to Reserve Pool
    console.log('Depositing withdrawn Rcoin to Reserve Pool...');
    const deposit1Tx = await Rcoin.depositRCOIN(ReservePoolAddress, ethers.parseUnits(withdrawnRcoin.toString(), 18));
    await deposit1Tx.wait();
    console.log('Deposited', withdrawnRcoin, 'Rcoin to Reserve Pool at address:', ReservePoolAddress);

  } catch (error) {
    console.error(`Error in Swap: ${error.message}`);
  }
};

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});

setInterval(async () => {
  const requiredRcoin = await SecurityPool();
  await swap(requiredRcoin);
}, 5000); // Run the SecurityPool and swap every 5 seconds
