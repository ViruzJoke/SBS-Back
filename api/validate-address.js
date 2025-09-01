// /api/validate-address.js
import fetch from 'node-fetch';

const ALLOWED_ORIGINS = [
    'https://viruzjoke.github.io',
    'thcfit.duckdns.org',
    'thcfit-admin.duckdns.org',
    'https://thcfit.vercel.app',
    'https://thcfit-admin.vercel.app'
];

// --- Hardcode API Key for testing ---
const DHL_API_KEY = '36c7dae5-aa2c-43f8-9494-e1bc2fff8c8d'; 
const DHL_API_ENDPOINT = 'https://wsbexpress.dhl.com/postalLocation/v1';

export default async function handler(req, res) {
    // --- START: CORS Handling ---
    const origin = req.headers.origin;
    if (ALLOWED_ORIGINS.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        console.log('Responding to OPTIONS preflight request.');
        return res.status(200).end();
    }
    // --- END: CORS Handling ---

    if (req.method !== 'GET') {
        res.setHeader('Allow', ['GET']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }
    
    console.log('Using HARDCODED DHL API Key (first 8 chars):', String(DHL_API_KEY).substring(0, 8));

    const { countryCode, postalCode, city, countyName } = req.query;
    console.log('Received query:', req.query); 

    if (!countryCode) {
        return res.status(400).json({ error: 'countryCode is a required parameter.' });
    }

    if (!postalCode && !city && !countyName) {
        return res.status(400).json({ error: 'At least one of postalCode, city, or countyName is required.' });
    }

    try {
        const params = new URLSearchParams({ key: DHL_API_KEY, countryCode });

        if (postalCode) params.append('postalCode', postalCode);
        if (city) params.append('city', city);
        if (countyName) params.append('countyName', countyName);

        const dhlApiUrl = `${DHL_API_ENDPOINT}?${params.toString()}`;
        console.log('Calling DHL API URL:', dhlApiUrl);

        // --- START: Adding custom headers to the fetch call ---
        const fetchOptions = {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'Vercel-Serverless-Function/1.0 (node-fetch)' 
                // We add a User-Agent to be more explicit.
            }
        };
        // --- END: Adding custom headers to the fetch call ---

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

        res.status(apiResponse.status);
        if (typeof responseData === 'string') {
            res.send(responseData);
        } else {
            res.json(responseData);
        }

    } catch (error) {
        console.error('Internal Server Error:', error);
        res.status(500).json({ error: 'An internal server error occurred.', details: error.message });
    }
}

