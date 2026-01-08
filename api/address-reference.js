// /api/reference-data.js
// Vercel Serverless Function for fetching reference data from DHL API.

import fetch from 'node-fetch';

// กำหนด Origins ที่อนุญาตให้เรียกใช้งาน API นี้ได้
const ALLOWED_ORIGINS = [
    'https://viruzjoke.github.io',
    'thcfit.duckdns.org',
    'thcfit-admin.duckdns.org',
    'https://thcfit.vercel.app',
    'https://thcfit-admin.vercel.app'
];

// ฟังก์ชันหลักของ API endpoint
export default async function handler(req, res) {
    // --- START: การตั้งค่า CORS Headers ---
    const origin = req.headers.origin;
    if (ALLOWED_ORIGINS.includes(origin) || !origin) {
        res.setHeader('Access-Control-Allow-Origin', origin || '*');
    }
    
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    // จัดการกับ pre-flight request (OPTIONS)
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    // --- END: การตั้งค่า CORS Headers ---

    // ตรวจสอบว่า request method เป็น GET เท่านั้น
    if (req.method !== 'GET') {
        res.setHeader('Allow', ['GET']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }
    
    // --- START: ดึงค่า Environment Variables ---
    const username = process.env.DHL_USERNAME;
    const password = process.env.DHL_PASSWORD;
    const dhlApiEndpoint = process.env.DHL_API_ENDPOINT_ADDRESS_REFER;
    // --- END: ดึงค่า Environment Variables ---

    // ตรวจสอบว่า Environment Variables มีครบถ้วนหรือไม่
    if (!username || !password || !dhlApiEndpoint) {
        console.error('DHL API environment variables for reference data are not configured correctly.');
        return res.status(500).json({ error: 'Server configuration error.' });
    }

    // ตรวจสอบว่ามีการส่ง parameter 'datasetName' มาเป็น 'country' หรือไม่
    const { datasetName } = req.query;
    if (datasetName !== 'country') {
        return res.status(400).json({ error: 'Required parameter "datasetName" must be set to "country".' });
    }

    try {
        // สร้าง Authorization Header แบบ Basic Auth
        const auth = 'Basic ' + Buffer.from(username + ':' + password).toString('base64');

        // สร้าง URL สำหรับยิงไปที่ DHL API
        const dhlApiUrl = `${dhlApiEndpoint}?datasetName=${datasetName}`;

        // ยิง request ไปยัง DHL API
        const apiResponse = await fetch(dhlApiUrl, {
            method: 'GET',
            headers: { 
                'Authorization': auth 
            }
        });

        // แปลง response ที่ได้กลับมาเป็น JSON
        const responseData = await apiResponse.json();

        // หาก request ไม่สำเร็จ (ไม่ใช่ status 2xx) ให้ส่ง error กลับไป
        if (!apiResponse.ok) {
            console.error('DHL Reference Data API Error:', responseData);
            return res.status(apiResponse.status).json({ error: 'DHL API Error', details: responseData });
        }

        // หากสำเร็จ ส่งข้อมูลที่ได้รับกลับไปยัง client
        res.status(200).json(responseData);

    } catch (error) {
        console.error('Internal Server Error while fetching reference data:', error);
        res.status(500).json({ error: 'An internal server error occurred.', details: error.message });
    }
}
