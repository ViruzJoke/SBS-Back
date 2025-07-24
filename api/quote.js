// /api/quote.js
// v2 - Added monetaryAmount, timezone fix, and robust logging.

import fetch from 'node-fetch';
import { sql } from '@vercel/postgres';

const ALLOWED_ORIGIN = 'https://viruzjoke.github.io';

export default async function handler(req, res) {
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

    const username = process.env.DHL_USERNAME;
    const password = process.env.DHL_PASSWORD;
    const ratesEndpoint = process.env.DHL_API_ENDPOINT_RATES;
    
    const formData = req.body;
    let dhlApiRequestPayload;

    try {
        if (!username || !password || !ratesEndpoint) {
            throw new Error('API environment variables are not configured correctly.');
        }

        // Build the base payload
        dhlApiRequestPayload = {
            customerDetails: {
                shipperDetails: { postalCode: formData.originPostalCode, cityName: formData.originCity, countryCode: formData.originCountry },
                receiverDetails: { postalCode: formData.destinationPostalCode, cityName: formData.destinationCity, countryCode: formData.destinationCountry }
            },
            // [MODIFIED] v4: Ensured correct timezone format for Thailand
            plannedShippingDateAndTime: `${formData.shipDate}T09:00:00GMT+07:00`,
            unitOfMeasurement: "metric",
            isCustomsDeclarable: formData.isParcel,
            requestAllValueAddedServices: false,
            packages: formData.packages.map(p => ({
                weight: parseFloat(p.weight),
                dimensions: { length: parseFloat(p.length), width: parseFloat(p.width), height: parseFloat(p.height) }
            })),
            accounts: [{ typeCode: "shipper", number: "CASHTHBKK" }]
        };

        // [MODIFIED] v4: Add monetaryAmount if it is a parcel and value is provided
        if (formData.isParcel && formData.declaredValue && formData.declaredCurrency) {
            dhlApiRequestPayload.monetaryAmount = [{
                typeCode: "declaredValue",
                value: parseFloat(formData.declaredValue),
                currency: formData.declaredCurrency
            }];
        }
        
        const auth = 'Basic ' + Buffer.from(username + ':' + password).toString('base64');
        
        // Log the request before sending
        console.log("Sending DHL Quote Request:", JSON.stringify(dhlApiRequestPayload, null, 2));

        const quoteResponse = await fetch(ratesEndpoint, {
            method: 'POST',
            headers: { 'Authorization': auth, 'Content-Type': 'application/json' },
            body: JSON.stringify(dhlApiRequestPayload)
        });

        const responseBodyText = await quoteResponse.text();
        
        // Try to parse JSON, but handle cases where it might not be JSON
        let quoteData;
        try {
            quoteData = JSON.parse(responseBodyText);
        } catch (e) {
            quoteData = { error: "Non-JSON Response", body: responseBodyText };
        }

        // [MODIFIED] v4: Enhanced logging
        if (!quoteResponse.ok) {
            console.error('DHL Rates API Error:', responseBodyText);
            await sql`
                INSERT INTO api_logs (created_at, log_type, request_data, response_data, error_data)
                VALUES (NOW() AT TIME ZONE 'Asia/Bangkok', 'quote_error', ${JSON.stringify(dhlApiRequestPayload)}, ${JSON.stringify(quoteData)}, ${quoteData.detail || responseBodyText});
            `;
            return res.status(quoteResponse.status).json({ error: `DHL API Error`, details: quoteData.detail || responseBodyText });
        }
        
        await sql`
            INSERT INTO api_logs (created_at, log_type, request_data, response_data)
            VALUES (NOW() AT TIME ZONE 'Asia/Bangkok', 'quote_success', ${JSON.stringify(dhlApiRequestPayload)}, ${JSON.stringify(quoteData)});
        `;

        res.status(200).json(quoteData);

    } catch (error) {
        // Log internal errors as well
        await sql`
            INSERT INTO api_logs (created_at, log_type, request_data, error_data)
            VALUES (NOW() AT TIME ZONE 'Asia/Bangkok', 'quote_internal_error', ${JSON.stringify(dhlApiRequestPayload || formData)}, ${error.message});
        `;
        console.error('Error processing quote request:', error);
        return res.status(500).json({ error: 'An internal server error occurred.', details: error.message });
    }
}
