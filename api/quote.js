// /api/quote.js

// ใช้ import แทน require สำหรับ ES Modules
import fetch from 'node-fetch';

// แก้ไขการ export เป็นแบบมาตรฐาน
export default async function handler(req, res) {
    // เพิ่ม Header เพื่อรองรับการทดสอบจากเครื่อง local (CORS)
    res.setHeader('Access-Control-Allow-Origin', '*'); 
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    // จัดการกับ OPTIONS request ที่เบราว์เซอร์ส่งมาก่อน POST จริง
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

    // --- Step 1: Get Access Token from DHL API ---
    const username = process.env.DHL_USERNAME;
    const password = process.env.DHL_PASSWORD;
    const ratesEndpoint = process.env.DHL_API_ENDPOINT_RATES;

    if (!username || !password || !ratesEndpoint) {
        return res.status(500).json({ error: 'API credentials or Rates Endpoint are not configured correctly on the server.' });
    }

    let accessToken;
    try {
        const auth = 'Basic ' + Buffer.from(username + ':' + password).toString('base64');
        const tokenResponse = await fetch('https://express.api.dhl.com/mydhlapi/auth/v1/token', {
            method: 'GET',
            headers: { 'Authorization': auth }
        });

        if (!tokenResponse.ok) {
            throw new Error(`DHL Auth API Error: ${tokenResponse.status} ${tokenResponse.statusText}`);
        }
        const tokenData = await tokenResponse.json();
        accessToken = tokenData.token_type + ' ' + tokenData.access_token;

    } catch (error) {
        console.error('Error fetching DHL token:', error);
        return res.status(500).json({ error: 'Failed to authenticate with DHL API.', details: error.message });
    }

    // --- Step 2: Prepare and Send Quote Request to DHL ---
    try {
        const formData = req.body;
        const dhlApiRequestPayload = {
            customerDetails: {
                shipperDetails: { postalCode: formData.originPostalCode, cityName: formData.originCity, countryCode: formData.originCountry },
                receiverDetails: { postalCode: formData.destinationPostalCode, cityName: formData.destinationCity, countryCode: formData.destinationCountry }
            },
            plannedShippingDateAndTime: `${formData.shipDate}T09:00:00 GMT+07:00`,
            unitOfMeasurement: "metric",
            isCustomsDeclarable: formData.isParcel,
            requestAllValueAddedServices: false,
            packages: formData.packages.map(p => ({
                weight: parseFloat(p.weight),
                dimensions: { length: parseFloat(p.length), width: parseFloat(p.width), height: parseFloat(p.height) }
            })),
            accounts: [{ typeCode: "shipper", number: "CASHTHBKK" }]
        };
        
        const quoteResponse = await fetch(ratesEndpoint, {
            method: 'POST',
            headers: {
                'Authorization': accessToken,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(dhlApiRequestPayload)
        });

        const responseBodyText = await quoteResponse.text();

        if (!quoteResponse.ok) {
            console.error('DHL Rates API Error:', responseBodyText);
            return res.status(quoteResponse.status).json({ error: `DHL API returned an error: ${quoteResponse.statusText}`, details: responseBodyText });
        }
        
        // ส่งกลับเป็น JSON ที่แปลงแล้ว
        res.status(200).json(JSON.parse(responseBodyText));

    } catch (error) {
        console.error('Error processing quote request:', error);
        return res.status(500).json({ error: 'An internal server error occurred.', details: error.message });
    }
}
