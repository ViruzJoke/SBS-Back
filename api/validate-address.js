// /api/validate-address.js
// This function acts as a proxy to the DHL Postal Location API.
// It forwards requests from the frontend, adding the necessary API key.

import fetch from 'node-fetch';

// The origin of your GitHub Pages site where the frontend is hosted.
const ALLOWED_ORIGIN = 'https://viruzjoke.github.io';

// Your DHL API Key.
const DHL_API_KEY = '36c7dae5-aa2c-43f8-9494-e1bc2fff8c8d';
const DHL_API_ENDPOINT = 'https://wsbexpress.dhl.com/postalLocation/v1';

export default async function handler(req, res) {
    // Set CORS headers to allow requests from your frontend.
    res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle preflight OPTIONS request for CORS.
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Ensure the request method is GET.
    if (req.method !== 'GET') {
        res.setHeader('Allow', ['GET']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

    // Extract query parameters from the request.
    const { countryCode, postalCode, city } = req.query;

    // Validate that required parameters are present.
    if (!countryCode) {
        return res.status(400).json({ error: 'countryCode is a required parameter.' });
    }

    if (!postalCode && !city) {
        return res.status(400).json({ error: 'Either postalCode or city is a required parameter.' });
    }

    try {
        // Construct the query parameters for the DHL API call.
        const params = new URLSearchParams({
            key: DHL_API_KEY,
            countryCode,
        });

        if (postalCode) {
            params.append('postalCode', postalCode);
        }
        if (city) {
            params.append('city', city);
        }

        const dhlApiUrl = `${DHL_API_ENDPOINT}?${params.toString()}`;

        // Call the DHL API.
        const apiResponse = await fetch(dhlApiUrl);
        const responseData = await apiResponse.json();

        // Check if the DHL API call was successful.
        if (!apiResponse.ok) {
            console.error('DHL API Error:', responseData);
            return res.status(apiResponse.status).json({ error: 'DHL API Error', details: responseData });
        }

        // Send the successful response from DHL back to the frontend.
        res.status(200).json(responseData);

    } catch (error) {
        // Handle any unexpected errors during the process.
        console.error('Internal Server Error:', error);
        res.status(500).json({ error: 'An internal server error occurred.', details: error.message });
    }
}
