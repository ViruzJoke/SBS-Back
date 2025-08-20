// /api/validate-address.js
// This function acts as a proxy to the DHL Postal Location API.
// It forwards requests from the frontend, adding the necessary API key.

import fetch from 'node-fetch';

const ALLOWED_ORIGINS = [
    'https://viruzjoke.github.io',
    'thcfit.duckdns.org',
    'thcfit-admin.duckdns.org',
    'https://thcfit.vercel.app',
    'https://thcfit-admin.vercel.app'
];

const DHL_API_KEY = '36c7dae5-aa2c-43f8-9494-e1bc2fff8c8d';
const DHL_API_ENDPOINT = 'https://wsbexpress.dhl.com/postalLocation/v1';

export default async function handler(req, res) {
    const origin = req.headers.origin;
    if (ALLOWED_ORIGINS.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }
    
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'GET') {
        res.setHeader('Allow', ['GET']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

    const { countryCode, postalCode, city } = req.query;

    if (!countryCode) {
        return res.status(400).json({ error: 'countryCode is a required parameter.' });
    }

    if (!postalCode && !city) {
        return res.status(400).json({ error: 'Either postalCode or city is a required parameter.' });
    }

    try {
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

        const apiResponse = await fetch(dhlApiUrl);
        const responseData = await apiResponse.json();

        if (!apiResponse.ok) {
            console.error('DHL API Error:', responseData);
            return res.status(apiResponse.status).json({ error: 'DHL API Error', details: responseData });
        }

        res.status(200).json(responseData);

    } catch (error) {
        console.error('Internal Server Error:', error);
        res.status(500).json({ error: 'An internal server error occurred.', details: error.message });
    }
}


