// /api/ship.js
// Vercel Serverless Function for creating a DHL Shipment
// v5 - Added account numbers to logs

import fetch from 'node-fetch';
import { sql } from '@vercel/postgres';

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

    const username = process.env.DHL_USERNAME;
    const password = process.env.DHL_PASSWORD;
    const shipEndpoint = process.env.DHL_API_ENDPOINT_SHIP;
    
    const dhlApiRequestPayload = req.body;

    try {
        if (!username || !password || !shipEndpoint) {
            throw new Error('API environment variables for shipment are not configured correctly on the server.');
        }

        const auth = 'Basic ' + Buffer.from(username + ':' + password).toString('base64');
        
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
            console.error('DHL Shipment API Non-JSON Response:', responseBodyText);
            try {
                await sql`
                    INSERT INTO shipment_logs (log_type, respond_warnings)
                    VALUES ('Error', ${'Failed to parse JSON response from DHL: ' + responseBodyText});
                `;
            } catch (dbError) {
                console.error("Database logging failed for Non-JSON response:", dbError);
            }
            return res.status(shipmentResponse.status || 500).json({ 
                title: 'API Error', 
                detail: 'Received an invalid response from the DHL server.',
                response: responseBodyText
            });
        }

        if (!shipmentResponse.ok) {
            console.error('DHL Shipment API Error:', responseBodyText);
            const errorMessage = shipmentData.detail || JSON.stringify(shipmentData);
            try {
                await sql`
                    INSERT INTO shipment_logs (log_type, respond_warnings)
                    VALUES ('Error', ${errorMessage});
                `;
            } catch (dbError) {
                console.error("Database logging failed for DHL API error:", dbError);
            }
            return res.status(shipmentResponse.status).json(shipmentData);
        }
        
        // On success, process and log the data
        try {
            // --- Extracting data from the request payload ---
            const shipper = dhlApiRequestPayload?.customerDetails?.shipperDetails;
            const receiver = dhlApiRequestPayload?.customerDetails?.receiverDetails;
            const accounts = dhlApiRequestPayload?.accounts || [];
            
            const shipperName = shipper?.contactInformation?.fullName || null;
            const shipperCompany = shipper?.contactInformation?.companyName || null;
            const shipperPhone = shipper?.contactInformation?.phone || null;
            const shipperCountry = shipper?.postalAddress?.countryCode || null;
            
            const receiverName = receiver?.contactInformation?.fullName || null;
            const receiverCompany = receiver?.contactInformation?.companyName || null;
            const receiverPhone = receiver?.contactInformation?.phone || null;
            const receiverCountry = receiver?.postalAddress?.countryCode || null;

            const requestReference = dhlApiRequestPayload?.customerReferences?.[0]?.value || null;
            
            // [NEW] Extract account numbers from the request
            const shipperAccountNumber = accounts.find(acc => acc.typeCode === 'shipper')?.number || null;
            const dutyAccountNumber = accounts.find(acc => acc.typeCode === 'duties-taxes')?.number || null;


            // --- Extracting data from the response payload ---
            const trackingNumber = shipmentData?.shipmentTrackingNumber || null;
            const packageIds = shipmentData?.packages?.map(p => p.trackingNumber).join(',') || null;
            const warnings = shipmentData?.warnings?.join('; ') || null;
            const findDocContent = (type) => shipmentData?.documents?.find(d => d.typeCode.toLowerCase() === type)?.content || null;
            const labelContent = findDocContent('label') || findDocContent('waybilldoc');
            const receiptContent = findDocContent('receipt') || findDocContent('shipmentreceipt');
            const invoiceContent = findDocContent('invoice');

            // [MODIFIED] Updated SQL INSERT statement with all new fields
            await sql`
                INSERT INTO shipment_logs (
                    log_type, 
                    respond_trackingnumber, 
                    respond_packagesid, 
                    respond_label, 
                    respond_receipt, 
                    respond_invoice, 
                    respond_warnings,
                    shipper_name,
                    shipper_company,
                    shipper_phone,
                    shipper_country,
                    receiver_name,
                    receiver_company,
                    receiver_phone,
                    receiver_country,
                    request_reference,
                    shipper_account_number,
                    duty_account_number
                )
                VALUES (
                    'Success', 
                    ${trackingNumber}, 
                    ${packageIds}, 
                    ${labelContent}, 
                    ${receiptContent}, 
                    ${invoiceContent}, 
                    ${warnings},
                    ${shipperName},
                    ${shipperCompany},
                    ${shipperPhone},
                    ${shipperCountry},
                    ${receiverName},
                    ${receiverCompany},
                    ${receiverPhone},
                    ${receiverCountry},
                    ${requestReference},
                    ${shipperAccountNumber},
                    ${dutyAccountNumber}
                );
            `;
        } catch (dbError) {
            console.error("Database logging failed for successful shipment:", dbError);
        }

        res.status(200).json(shipmentData);

    } catch (error) {
        try {
            await sql`
                INSERT INTO shipment_logs (log_type, respond_warnings)
                VALUES ('Error', ${error.message});
            `;
        } catch (dbError) {
            console.error("Database logging failed for internal server error:", dbError);
        }
        console.error('Error processing shipment request:', error);
        return res.status(500).json({ 
            title: 'Internal Server Error', 
            detail: 'An unexpected error occurred on the server.',
            errorMessage: error.message 
        });
    }
}
