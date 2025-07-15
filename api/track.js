// ไฟล์: api/track.js
// นี่คือโค้ดสำหรับ Serverless Function ที่ปรับปรุงแล้ว
// ให้ใช้ синтаксис ของ ES Module (export default) และรวมตรรกะจากไฟล์เดิม

// ดึงข้อมูล Credential และ Endpoint จาก Environment Variables
// คุณโจ็กต้องไปตั้งค่าตัวแปรเหล่านี้ใน Vercel Dashboard นะครับ
const DHL_API_ENDPOINT = process.env.DHL_API_ENDPOINT || 'https://express.api.dhl.com/mydhlapi/tracking';
const DHL_USERNAME = process.env.DHL_USERNAME;
const DHL_PASSWORD = process.env.DHL_PASSWORD;

// ฟังก์ชันหลักที่ Vercel จะเรียกใช้
export default async function handler(req, res) {
    // *** การตั้งค่า CORS (Cross-Origin Resource Sharing) ***
    // ระบุโดเมนของ Frontend ที่จะอนุญาตให้เรียก API นี้ได้
    const allowedOrigin = 'https://viruzjoke.github.io'; 

    res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Max-Age', '86400'); // 24 ชั่วโมง

    // จัดการ CORS Preflight Request
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // ดึง trackingNumber จาก Query Parameters
    const { trackingNumber } = req.query;

    if (!trackingNumber) {
        return res.status(400).json({ error: 'Bad Request', message: 'Tracking number is required.' });
    }

    // ตรวจสอบว่า Environment Variables ถูกตั้งค่าครบหรือไม่
    if (!DHL_USERNAME || !DHL_PASSWORD) {
        console.error('Environment variables for DHL_USERNAME or DHL_PASSWORD are not set.');
        return res.status(500).json({ title: 'Internal Server Error', detail: 'API credentials are not configured on the server.' });
    }

    // เข้ารหัส Basic Authentication
    const base64Credentials = Buffer.from(`${DHL_USERNAME}:${DHL_PASSWORD}`).toString('base64');

    try {
        // สร้าง URL สำหรับเรียก DHL API จริงๆ
        const dhlApiUrl = `${DHL_API_ENDPOINT}?shipmentTrackingNumber=${encodeURIComponent(trackingNumber)}&trackingView=all-checkpoints`;

        // เรียก DHL API
        const apiResponse = await fetch(dhlApiUrl, {
            method: 'GET',
            headers: {
                'Authorization': `Basic ${base64Credentials}`,
                'Accept': 'application/json'
            }
        });
        
        const responseBody = await apiResponse.text();

        // [FIX] แก้ไขส่วนจัดการ Error
        if (!apiResponse.ok) {
            console.error('DHL API Error:', apiResponse.status, responseBody);
            let errorJson;
            try {
                // พยายามแปลง response ที่ผิดพลาดให้เป็น JSON
                errorJson = JSON.parse(responseBody);
            } catch (e) {
                // ถ้า response ไม่ใช่ JSON ให้สร้าง object error ขึ้นมาเอง
                errorJson = { 
                    title: `Error ${apiResponse.status}`, 
                    detail: responseBody || 'An error occurred while fetching from DHL API.' 
                };
            }
            // ส่งต่อ error object ทั้งหมดกลับไปให้ Frontend
            return res.status(apiResponse.status).json(errorJson);
        }

        const data = JSON.parse(responseBody);

        // ส่งข้อมูลที่ได้รับกลับไปยัง Frontend
        res.status(200).json(data);

    } catch (error) {
        // จัดการข้อผิดพลาดอื่นๆ ที่อาจเกิดขึ้น
        console.error('Serverless Function Error:', error);
        res.status(500).json({ title: 'Internal Server Error', detail: error.message });
    }
}
