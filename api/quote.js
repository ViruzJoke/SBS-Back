// /api/quote.js

const fetch = require('node-fetch');

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

    // --- Step 1: Get Access Token from DHL API ---
    // [FIX] Using existing Vercel variable names: DHL_USERNAME and DHL_PASSWORD
    const username = process.env.DHL_USERNAME;
    const password = process.env.DHL_PASSWORD;
    
    // [NEW] Using a new Vercel variable for the rates endpoint
    const ratesEndpoint = process.env.DHL_API_ENDPOINT_RATES;

    if (!username || !password || !ratesEndpoint) {
        // Updated error message to be more specific
        return res.status(500).json({ error: 'API credentials or Rates Endpoint are not configured correctly on the server. Please check DHL_USERNAME, DHL_PASSWORD, and DHL_API_ENDPOINT_RATES.' });
    }

    let accessToken;
    try {
        const auth = 'Basic ' + Buffer.from(username + ':' + password).toString('base64');
        const tokenResponse = await fetch('https://express.api.dhl.com/mydhlapi/auth/v1/token', {
            method: 'GET',
            headers: { 'Authorization': auth }
        });

        if (!tokenResponse.ok) {
            throw new Error(`DHL Auth API Error: ${tokenResponse.statusText}`);
        }
        const tokenData = await tokenResponse.json();
        accessToken = tokenData.token_type + ' ' + tokenData.access_token;

    } catch (error) {
        console.error('Error fetching DHL token:', error);
        return res.status(500).json({ error: 'Failed to authenticate with DHL API.' });
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

        // [FIX] Using the new environment variable for the endpoint URL
        const quoteResponse = await fetch(ratesEndpoint, {
            method: 'POST',
            headers: {
                'Authorization': accessToken,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(dhlApiRequestPayload)
        });

        if (!quoteResponse.ok) {
            const errorBody = await quoteResponse.text();
            console.error('DHL Rates API Error:', errorBody);
            return res.status(quoteResponse.status).json({ error: `DHL API returned an error: ${quoteResponse.statusText}`, details: errorBody });
        }
        
        const quoteData = await quoteResponse.json();
        res.status(200).json(quoteData);

    } catch (error) {
        console.error('Error processing quote request:', error);
        return res.status(500).json({ error: 'An internal server error occurred.' });
    }
}
