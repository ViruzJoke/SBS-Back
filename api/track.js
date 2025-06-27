// ในไฟล์ /api/track.js ของโปรเจกต์ Backend บน Vercel

export default async function handler(req, res) {
    // ---- การตั้งค่า CORS ----
    // อนุญาตให้หน้าเว็บของคุณเรียก API นี้ได้
    res.setHeader('Access-Control-Allow-Origin', '*'); // ใน Production ควรระบุเป็นโดเมนของคุณ
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    // จัดการ OPTIONS request สำหรับ CORS
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    // -------------------------

    const { trackingNumber } = req.query;

    if (!trackingNumber) {
        return res.status(400).json({ error: 'Tracking number is required' });
    }

    // --- การจัดการ Basic Authentication ---
    // ดึง Username และ Password จาก Environment Variables บน Vercel
    const username = process.env.DHL_USERNAME;
    const password = process.env.DHL_PASSWORD;

    if (!username || !password) {
        console.error('Authentication credentials are not configured on the server.');
        return res.status(500).json({ error: 'Authentication is not configured on the server.' });
    }

    // สร้างข้อมูลสำหรับ Basic Auth Header
    const basicAuth = Buffer.from(`${username}:${password}`).toString('base64');
    // ------------------------------------

    const dhlApiUrl = `https://api-eu.dhl.com/track/shipments?trackingNumber=${trackingNumber}`;

    try {
        const apiResponse = await fetch(dhlApiUrl, {
            headers: {
                // เพิ่ม Header สำหรับ Basic Authentication
                'Authorization': `Basic ${basicAuth}`,
                'Accept': 'application/json'
            }
        });

        const responseBody = await apiResponse.text();
        
        if (!apiResponse.ok) {
            let errorData;
            try {
                errorData = JSON.parse(responseBody);
            } catch(e) {
                errorData = { error: 'Received non-JSON error from DHL API', details: responseBody };
            }
            console.error('DHL API Error:', errorData);
            return res.status(apiResponse.status).json(errorData);
        }

        const data = JSON.parse(responseBody);
        res.status(200).json(data);

    } catch (error) {
        console.error('Internal Server Error:', error);
        res.status(500).json({ error: 'Failed to fetch tracking information.' });
    }
}
