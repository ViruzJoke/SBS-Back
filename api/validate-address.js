// /api/validate-address.js
// This function acts as a proxy to the DHL Postal Location API.
// It forwards requests from the frontend, adding the necessary API key.

import fetch from 'node-fetch';

// 1. เปลี่ยนจาก String เป็น Array และเพิ่ม Origin ที่ต้องการอนุญาต
const ALLOWED_ORIGINS = [
    'https://viruzjoke.github.io',
    'thcfit.duckdns.org'
    // เพิ่ม Origin อื่นๆ ที่นี่ได้เลย
    // 'https://your-vercel-preview-url.vercel.app'
];

// Your DHL API Key.
const DHL_API_KEY = '36c7dae5-aa2c-43f8-9494-e1bc2fff8c8d';
const DHL_API_ENDPOINT = 'https://wsbexpress.dhl.com/postalLocation/v1';

export default async function handler(req, res) {
    // 2. เพิ่มตรรกะในการตรวจสอบและตั้งค่า CORS Header แบบไดนามิก
    const origin = req.headers.origin;
    if (ALLOWED_ORIGINS.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }
    
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
