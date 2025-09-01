// /api/validate-address.js
// This function acts as a proxy to the DHL Postal Location API.
// It forwards requests from the frontend, adding the necessary API key from environment variables.

import fetch from 'node-fetch';

const ALLOWED_ORIGINS = [
    'https://viruzjoke.github.io',
    'thcfit.duckdns.org',
    'thcfit-admin.duckdns.org',
    'https://thcfit.vercel.app',
    'https://thcfit-admin.vercel.app'
];

// --- การตั้งค่า API Key ---
// หากต้องการทดสอบ ให้สลับ Comment บรรทัดด้านล่าง
// const DHL_API_KEY = '36c7dae5-aa2c-43f8-9494-e1bc2fff8c8d'; // <--- Hardcode สำหรับทดสอบ
const DHL_API_KEY = process.env.DHL_VALIDATE_ADDRESS_API_KEY; // <--- ดึงจาก Environment Variables (วิธีที่ถูกต้อง)
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
    
    // LOG 1: ตรวจสอบว่า API Key ถูกโหลดมาหรือไม่
    if (!DHL_API_KEY) {
        console.error('CRITICAL: DHL_VALIDATE_ADDRESS_API_KEY is not set!');
        return res.status(500).json({ error: 'Server configuration error: API Key is missing.' });
    }

    // LOG 2: แสดงค่า API Key ที่กำลังใช้งาน (จะแสดงแค่บางส่วนเพื่อความปลอดภัยใน Log)
    console.log('Using DHL API Key (first 8 chars):', String(DHL_API_KEY).substring(0, 8)); 

    const { countryCode, postalCode, city, countyName } = req.query;
    
    // LOG 3: แสดงค่า Query Parameters ที่ได้รับมาจาก Frontend
    console.log('Received query:', req.query); 

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

        if (postalCode) params.append('postalCode', postalCode);
        if (city) params.append('city', city);
        if (countyName) params.append('countyName', countyName);

        const dhlApiUrl = `${DHL_API_ENDPOINT}?${params.toString()}`;

        // LOG 4: แสดง URL ที่จะใช้เรียกไปยัง DHL API
        console.log('Calling DHL API URL:', dhlApiUrl);

        const apiResponse = await fetch(dhlApiUrl);
        const responseData = await apiResponse.json();

        // LOG 5: บันทึกสถานะและข้อมูลที่ได้รับจาก DHL ทุกครั้ง ไม่ว่าจะ Success หรือ Error
        console.log('DHL API Response Status:', apiResponse.status); 
        console.log('DHL API Response Body:', JSON.stringify(responseData, null, 2));

        if (!apiResponse.ok) {
            return res.status(apiResponse.status).json({ error: 'DHL API Error', details: responseData });
        }

        res.status(200).json(responseData);

    } catch (error) {
        console.error('Internal Server Error:', error);
        res.status(500).json({ error: 'An internal server error occurred.', details: error.message });
    }
}
