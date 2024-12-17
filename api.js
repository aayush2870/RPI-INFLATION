const axios = require('axios'); // Only if using Node.js or a similar environment

// Replace with your actual API key
const API_KEY = '954b71b33c0fe757146ffe4c';
const BASE_URL = 'https://v6.exchangerate-api.com/v6'; // Base URL for the API
const ENDPOINT = `${BASE_URL}/${API_KEY}/latest/INR`; // Endpoint to get the latest rates for INR

async function getINRToUSDRate() {
    try {
        const response = await axios.get(ENDPOINT);
        const inrToUsdRate = response.data.conversion_rates.USD; // Fetch the USD rate
        console.log(`1 INR = ${inrToUsdRate} USD`);
        return inrToUsdRate;
    } catch (error) {
        console.error('Error fetching exchange rate:', error);
        return null;
    }
}

// Call the function to fetch the exchange rate
getINRToUSDRate();
