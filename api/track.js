// ไฟล์: api/track.js

// นี่คือโค้ดสำหรับ Serverless Function ที่จะทำงานบน Vercel
// หน้าที่ของมันคือรับคำขอจาก Frontend (GitHub Pages)
// จากนั้นเรียก API ของ DHL ด้วยข้อมูล Username/Password ที่ถูกซ่อนไว้ (Environment Variables)
// และส่งผลลัพธ์กลับไปยัง Frontend

// ดึงข้อมูล Credential และ Endpoint จาก Environment Variables
// ตัวแปรเหล่านี้จะถูกตั้งค่าใน Vercel Dashboard ในขั้นตอนต่อไป
const DHL_API_ENDPOINT = process.env.DHL_API_ENDPOINT;
const DHL_USERNAME = process.env.DHL_USERNAME;
const DHL_PASSWORD = process.env.DHL_PASSWORD;

module.exports = async (req, res) => {
    // *** สำคัญมาก: การตั้งค่า CORS (Cross-Origin Resource Sharing) ***
    // เราต้องบอกเบราว์เซอร์ว่า Vercel Function นี้ อนุญาตให้โดเมน GitHub Pages ของคุณเรียกใช้งานได้
    // โปรดเปลี่ยน 'https://YOUR_GITHUB_PAGES_URL' เป็น URL จริงของ GitHub Pages ของคุณ
    // ตัวอย่าง: 'https://joker.github.io/DBS/' หรือ 'https://your-username.github.io/your-repo-name/'
    // หากคุณยังไม่แน่ใจ URL ที่แน่นอน ให้ใส่ '*' ไปก่อนชั่วคราว (แต่ไม่แนะนำสำหรับ Production)
    const allowedOrigin = 'https://viruzjoke.github.io'; 

    // ตั้งค่า Header สำหรับ CORS
    // Access-Control-Allow-Origin: บอกว่าโดเมนไหนที่สามารถเรียก API นี้ได้
    // Access-Control-Allow-Methods: บอกว่าอนุญาต HTTP Method อะไรบ้าง
    // Access-Control-Allow-Headers: บอกว่าอนุญาต Header อะไรบ้างในคำขอ
    // Access-Control-Max-Age: บอกว่าเบราว์เซอร์ควรแคชผลลัพธ์ของ Preflight Request นานแค่ไหน
    res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type'); // ไม่ต้องใส่ Authorization ตรงนี้ เพราะ Frontend ไม่ได้ส่ง Basic Auth
    res.setHeader('Access-Control-Max-Age', '86400'); // 24 ชั่วโมง

    // จัดการ CORS Preflight Request (เบราว์เซอร์จะส่ง OPTIONS request มาก่อนเพื่อตรวจสอบสิทธิ์)
    if (req.method === 'OPTIONS') {
        // ถ้าเป็น OPTIONS request ให้ตอบกลับ 200 OK ทันทีพร้อม Headers CORS
        return res.status(200).end();
    }

    // ตรวจสอบว่า HTTP Method เป็น GET หรือไม่
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method Not Allowed', message: 'Only GET requests are supported.' });
    }

    // ดึง trackingNumber จาก Query Parameters (ตัวอย่าง: /api/track?trackingNumber=123)
    const { trackingNumber } = req.query;

    if (!trackingNumber) {
        return res.status(400).json({ error: 'Bad Request', message: 'Tracking number is required.' });
    }

    // ตรวจสอบว่า Environment Variables ถูกตั้งค่าหรือไม่
    if (!DHL_API_ENDPOINT || !DHL_USERNAME || !DHL_PASSWORD) {
        console.error('Environment variables not set for DHL API. Please configure them in Vercel Dashboard.');
        return res.status(500).json({ error: 'Internal Server Error', message: 'API credentials are not configured on the server. Please contact support.' });
    }

    // เข้ารหัส Basic Authentication สำหรับการเรียก DHL API
    const base64Credentials = Buffer.from(`${DHL_USERNAME}:${DHL_PASSWORD}`).toString('base64');

    try {
        // สร้าง URL สำหรับเรียก DHL API จริงๆ
        // เราจะส่ง trackingView=all-checkpoints เพื่อให้ได้ข้อมูลละเอียด
        const dhlApiUrl = `${DHL_API_ENDPOINT}?shipmentTrackingNumber=${encodeURIComponent(trackingNumber)}&trackingView=all-checkpoints`;

        // ทำการเรียก DHL API จาก Serverless Function (นี่คือส่วนที่ Credential ถูกใช้และถูกซ่อน)
        const apiResponse = await fetch(dhlApiUrl, {
            method: 'GET',
            headers: {
                'Authorization': `Basic ${base64Credentials}`,
                'Content-Type': 'application/json'
            }
        });

        if (!apiResponse.ok) {
            // ส่งต่อ Error Status และ Message จาก DHL API กลับไปยัง Frontend
            const errorText = await apiResponse.text();
            console.error('DHL API Error:', apiResponse.status, errorText);
            let userMessage = `DHL API Error: ${apiResponse.status}.`;
            try {
                const errorJson = JSON.parse(errorText);
                userMessage += ` Details: ${errorJson.detail || errorJson.title || errorJson.message || errorText}`;
            } catch (e) {
                userMessage += ` Details: ${errorText}`;
            }
            return res.status(apiResponse.status).json({
                error: `DHL API Error: ${apiResponse.status}`,
                message: userMessage
            });
        }

        const data = await apiResponse.json();

        // ส่งข้อมูลที่ได้รับจาก DHL API กลับไปยัง Frontend ของคุณ
        res.status(200).json(data);

    } catch (error) {
        // จัดการข้อผิดพลาดที่เกิดขึ้นใน Serverless Function
        console.error('Serverless Function Error:', error);
        res.status(500).json({ error: 'Internal Server Error', message: error.message || 'An unexpected error occurred in the serverless function.' });
    }
};
