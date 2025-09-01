// /api/validate-address.js
import fetch from 'node-fetch';

// --- Hardcode API Key for testing ---
const DHL_API_KEY = '36c7dae5-aa2c-43f8-9494-e1bc2fff8c8d'; 
const DHL_API_ENDPOINT = 'https://wsbexpress.dhl.com/postalLocation/v1';

// --- List of allowed origins ---
const ALLOWED_ORIGINS = [
    'https://viruzjoke.github.io',
    'null' // Allow requests from local files (file://) for testing
];

export default async function handler(req, res) {
    // --- START: Dynamic CORS Handling ---
    const origin = req.headers.origin;
    if (ALLOWED_ORIGINS.includes(origin) || origin === undefined) { // origin can be undefined for local files in some cases
        res.setHeader('Access-Control-Allow-Origin', origin || '*');
    }
    
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Requested-With'); // Add common headers

    // Handle the preflight OPTIONS request
    if (req.method === 'OPTIONS') {
        console.log(`Responding to OPTIONS request from origin: ${origin}`);
        return res.status(200).end();
    }
    // --- END: Dynamic CORS Handling ---

    if (req.method !== 'GET') {
        res.setHeader('Allow', ['GET']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }
    
    console.log(`Handling GET request from origin: ${origin}`);
    console.log('Using HARDCODED DHL API Key (first 8 chars):', String(DHL_API_KEY).substring(0, 8));

    const { countryCode, postalCode, city, countyName } = req.query;
    console.log('Received query:', req.query); 

    if (!countryCode) {
        return res.status(400).json({ error: 'countryCode is a required parameter.' });
    }

    try {
        const params = new URLSearchParams({ key: DHL_API_KEY, countryCode });
        if (postalCode) params.append('postalCode', postalCode);
        if (city) params.append('city', city);
        if (countyName) params.append('countyName', countyName);

        const dhlApiUrl = `${DHL_API_ENDPOINT}?${params.toString()}`;
        console.log('Calling DHL API URL:', dhlApiUrl);

        // Mimic browser headers more closely
        const fetchOptions = {
            method: 'GET',
            headers: {
                'Accept': 'application/json, text/plain, */*',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36'
            }
        };

        const apiResponse = await fetch(dhlApiUrl, fetchOptions);
        
        let responseData;
        const contentType = apiResponse.headers.get("content-type");
        if (contentType && contentType.indexOf("application/json") !== -1) {
            responseData = await apiResponse.json();
        } else {
            responseData = await apiResponse.text();
        }

        console.log('DHL API Response Status:', apiResponse.status); 
        console.log('DHL API Response Body:', typeof responseData === 'string' ? responseData : JSON.stringify(responseData, null, 2));

        res.status(apiResponse.status).json(responseData);

    } catch (error) {
        console.error('Internal Server Error:', error);
        res.status(500).json({ error: 'An internal server error occurred.', details: error.message });
    }
}

