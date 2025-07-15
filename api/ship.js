// /api/ship.js
// Vercel Serverless Function for creating a DHL Shipment

import fetch from 'node-fetch';
import { sql } from '@vercel/postgres';

// [IMPORTANT] This is the domain of your frontend.
// This tells the server to only allow requests from your specific GitHub Pages site.
const ALLOWED_ORIGIN = 'https://viruzjoke.github.io';

export default async function handler(req, res) {
    // Set CORS headers to allow requests from your frontend
    res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    // Handle the browser's preflight OPTIONS request
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

    // Get DHL credentials and the specific shipment endpoint from environment variables
    const username = process.env.DHL_USERNAME;
    const password = process.env.DHL_PASSWORD;
    const shipEndpoint = process.env.DHL_API_ENDPOINT_SHIP; // Use the shipment endpoint
    
    // The request body from the frontend is the complete payload for the DHL API
    const dhlApiRequestPayload = req.body;

    try {
        // Validate that all required environment variables are set
        if (!username || !password || !shipEndpoint) {
            throw new Error('API environment variables for shipment are not configured correctly on the server.');
        }

        // Basic Authentication
        const auth = 'Basic ' + Buffer.from(username + ':' + password).toString('base64');
        
        // Call the DHL Shipment API
        const shipmentResponse = await fetch(shipEndpoint, {
            method: 'POST',
            headers: { 
                'Authorization': auth, 
                'Content-Type': 'application/json' 
            },
            body: JSON.stringify(dhlApiRequestPayload)
        });

        const responseBodyText = await shipmentResponse.text();
        let shipmentData;
        
        try {
             shipmentData = JSON.parse(responseBodyText);
        } catch(e) {
            // If response is not JSON, it's likely an error from the server/proxy
            console.error('DHL Shipment API Non-JSON Response:', responseBodyText);
             await sql`
                INSERT INTO api_logs (log_type, request_data, response_data, error_data)
                VALUES ('shipment_error', ${JSON.stringify(dhlApiRequestPayload)}, ${responseBodyText}, 'Failed to parse JSON response.');
            `;
            return res.status(shipmentResponse.status || 500).json({ 
                title: 'API Error', 
                detail: 'Received an invalid response from the server.',
                response: responseBodyText
            });
        }


        // Handle API errors from DHL
        if (!shipmentResponse.ok) {
            console.error('DHL Shipment API Error:', responseBodyText);
            // Log the error to the database
            await sql`
                INSERT INTO api_logs (log_type, request_data, response_data, error_data)
                VALUES ('shipment_error', ${JSON.stringify(dhlApiRequestPayload)}, ${JSON.stringify(shipmentData)}, ${shipmentData.detail || responseBodyText});
            `;
            // Return the detailed error to the frontend
            return res.status(shipmentResponse.status).json(shipmentData);
        }
        
        // Log the successful request to the database
        await sql`
            INSERT INTO api_logs (log_type, request_data, response_data, shipment_tracking_number)
            VALUES ('shipment_success', ${JSON.stringify(dhlApiRequestPayload)}, ${JSON.stringify(shipmentData)}, ${shipmentData.shipmentTrackingNumber});
        `;

        // Send the successful response back to the frontend
        res.status(200).json(shipmentData);

    } catch (error) {
        // Log any other server-side errors
        await sql`
            INSERT INTO api_logs (log_type, request_data, error_data)
            VALUES ('shipment_error', ${JSON.stringify(dhlApiRequestPayload)}, ${error.message});
        `;
        console.error('Error processing shipment request:', error);
        return res.status(500).json({ 
            title: 'Internal Server Error', 
            detail: 'An unexpected error occurred on the server.',
            errorMessage: error.message 
        });
    }
}
