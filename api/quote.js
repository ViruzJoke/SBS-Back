// /api/quote.js

import fetch from 'node-fetch';

const ALLOWED_ORIGIN = 'https://viruzjoke.github.io';

export default async function handler(req, res) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

    // --- [FIX] Simplified to a 1-step process: Direct API call with Basic Auth ---

    const username = process.env.DHL_USERNAME;
    const password = process.env.DHL_PASSWORD;
    const ratesEndpoint = process.env.DHL_API_ENDPOINT_RATES;

    if (!username || !password || !ratesEndpoint) {
        return res.status(500).json({ error: 'API environment variables are not configured correctly. Please check DHL_USERNAME, DHL_PASSWORD, and DHL_API_ENDPOINT_RATES.' });
    }

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
        
        // Create the Basic Authentication header directly from credentials
        const auth = 'Basic ' + Buffer.from(username + ':' + password).toString('base64');
        
        // Make the POST request directly to the rates endpoint with the Basic Auth header
        const quoteResponse = await fetch(ratesEndpoint, {
            method: 'POST',
            headers: {
                'Authorization': auth, // Using Basic Auth here
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(dhlApiRequestPayload)
        });

        const responseBodyText = await quoteResponse.text();

        if (!quoteResponse.ok) {
            console.error('DHL Rates API Error:', responseBodyText);
            return res.status(quoteResponse.status).json({ error: `DHL API returned an error: ${quoteResponse.statusText}`, details: responseBodyText });
        }
        
        // Send back the parsed JSON response
        res.status(200).json(JSON.parse(responseBodyText));

    } catch (error) {
        console.error('Error processing quote request:', error);
        return res.status(500).json({ error: 'An internal server error occurred.', details: error.message });
    }
}
