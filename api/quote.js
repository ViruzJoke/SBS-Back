// /api/quote.js

import fetch from 'node-fetch';
import { sql } from '@vercel/postgres';

// [IMPORTANT] This is the domain of your frontend.
// This tells the server to only allow requests from your specific GitHub Pages site.
const ALLOWED_ORIGIN = 'https://viruzjoke.github.io';

export default async function handler(req, res) {
    // [FIX] Set CORS headers to allow requests from your frontend
    res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    // [FIX] Handle the browser's preflight OPTIONS request
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

    const username = process.env.DHL_USERNAME;
    const password = process.env.DHL_PASSWORD;
    const ratesEndpoint = process.env.DHL_API_ENDPOINT_RATES;
    
    const formData = req.body;
    let dhlApiRequestPayload;

    try {
        if (!username || !password || !ratesEndpoint) {
            throw new Error('API environment variables are not configured correctly.');
        }

        dhlApiRequestPayload = {
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
        
        const auth = 'Basic ' + Buffer.from(username + ':' + password).toString('base64');
        
        const quoteResponse = await fetch(ratesEndpoint, {
            method: 'POST',
            headers: { 'Authorization': auth, 'Content-Type': 'application/json' },
            body: JSON.stringify(dhlApiRequestPayload)
        });

        const responseBodyText = await quoteResponse.text();
        const quoteData = JSON.parse(responseBodyText);

        if (!quoteResponse.ok) {
            console.error('DHL Rates API Error:', responseBodyText);
            await sql`
                INSERT INTO api_logs (log_type, request_data, response_data, error_data)
                VALUES ('quote_error', ${JSON.stringify(dhlApiRequestPayload)}, ${JSON.stringify(quoteData)}, ${quoteData.detail || responseBodyText});
            `;
            return res.status(quoteResponse.status).json({ error: `DHL API Error`, details: quoteData.detail || responseBodyText });
        }
        
        await sql`
            INSERT INTO api_logs (log_type, request_data, response_data)
            VALUES ('quote_success', ${JSON.stringify(dhlApiRequestPayload)}, ${JSON.stringify(quoteData)});
        `;

        res.status(200).json(quoteData);

    } catch (error) {
        await sql`
            INSERT INTO api_logs (log_type, request_data, error_data)
            VALUES ('quote_error', ${JSON.stringify(dhlApiRequestPayload || formData)}, ${error.message});
        `;
        console.error('Error processing quote request:', error);
        return res.status(500).json({ error: 'An internal server error occurred.', details: error.message });
    }
}
