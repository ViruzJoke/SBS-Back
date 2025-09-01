// /api/validate-address.js
// ฟังก์ชันนี้ทำหน้าที่เป็น Proxy ไปยัง DHL Postal Location API
// โดยจะส่งต่อ request จาก frontend พร้อมกับเพิ่ม API key ที่จำเป็นจาก Environment Variables

import fetch from 'node-fetch';

const ALLOWED_ORIGINS = [
    '[https://viruzjoke.github.io](https://viruzjoke.github.io)',
    'thcfit.duckdns.org',
    'thcfit-admin.duckdns.org',
    '[https://thcfit.vercel.app](https://thcfit.vercel.app)',
    '[https://thcfit-admin.vercel.app](https://thcfit-admin.vercel.app)'
];

const DHL_API_KEY = process.env.DHL_VALIDATE_ADDRESS_API_KEY;
const DHL_API_ENDPOINT = 'https://wsbexpress.dhl.com/postalLocation/v1';

export default async function handler(req, res) {
    const origin = req.headers.origin;
    if (ALLOWED_ORIGINS.includes(origin) || !origin) {
        res.setHeader('Access-Control-Allow-Origin', origin || '*');
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

    if (!DHL_API_KEY) {
        console.error('DHL_VALIDATE_ADDRESS_API_KEY is not set in environment variables.');
        return res.status(500).json({ error: 'Server configuration error.' });
    }

    const { countryCode, postalCode, city, countyName } = req.query;

    if (!countryCode) {
        return res.status(400).json({ error: 'countryCode is a required parameter.' });
    }

    if (!postalCode && !city && !countyName) {
        return res.status(400).json({ error: 'At least one of postalCode, city, or countyName is required.' });
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
        if (countyName) {
            params.append('countyName', countyName);
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


