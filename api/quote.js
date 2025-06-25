// /api/quote.js

// Import 'node-fetch' to make HTTP requests in a Node.js environment.
const fetch = require('node-fetch');

// The main handler for the serverless function.
export default async function handler(req, res) {
    // We only accept POST requests for this endpoint.
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

    // --- Step 1: Get Access Token from DHL API ---
    // Retrieve credentials from environment variables for security.
    const username = process.env.DHL_API_USERNAME;
    const password = process.env.DHL_API_PASSWORD;

    // Check if credentials are set up in Vercel.
    if (!username || !password) {
        return res.status(500).json({ error: 'API credentials are not configured on the server.' });
    }

    let accessToken;
    try {
        // Encode credentials for Basic Authentication.
        const auth = 'Basic ' + Buffer.from(username + ':' + password).toString('base64');
        
        // Request an access token from the DHL authentication endpoint.
        const tokenResponse = await fetch('https://express.api.dhl.com/mydhlapi/auth/v1/token', {
            method: 'GET',
            headers: { 'Authorization': auth }
        });

        // If the token request fails, throw an error.
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
        // Get the data sent from the frontend form.
        const formData = req.body;

        // Construct the request payload for the DHL Rates API.
        const dhlApiRequestPayload = {
            customerDetails: {
                shipperDetails: {
                    postalCode: formData.originPostalCode,
                    cityName: formData.originCity,
                    countryCode: formData.originCountry
                },
                receiverDetails: {
                    postalCode: formData.destinationPostalCode,
                    cityName: formData.destinationCity,
                    countryCode: formData.destinationCountry
                }
            },
            // Format the date and time as required by DHL API.
            plannedShippingDateAndTime: `${formData.shipDate}T09:00:00 GMT+07:00`,
            unitOfMeasurement: "metric",
            isCustomsDeclarable: formData.isParcel,
            requestAllValueAddedServices: false,
            packages: formData.packages.map(p => ({
                weight: parseFloat(p.weight),
                dimensions: {
                    length: parseFloat(p.length),
                    width: parseFloat(p.width),
                    height: parseFloat(p.height)
                }
            })),
            accounts: [
                {
                    typeCode: "shipper",
                    number: "CASHTHBKK"
                }
            ]
        };

        // Make the POST request to the DHL Rates endpoint.
        const quoteResponse = await fetch('https://express.api.dhl.com/mydhlapi/rates', {
            method: 'POST',
            headers: {
                'Authorization': accessToken,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(dhlApiRequestPayload)
        });

        // If the quote request fails, return the error details from DHL.
        if (!quoteResponse.ok) {
            const errorBody = await quoteResponse.text();
            console.error('DHL Rates API Error:', errorBody);
            return res.status(quoteResponse.status).json({
                error: `DHL API returned an error: ${quoteResponse.statusText}`,
                details: errorBody 
            });
        }
        
        // Parse the successful response and send it back to the frontend.
        const quoteData = await quoteResponse.json();
        res.status(200).json(quoteData);

    } catch (error) {
        console.error('Error processing quote request:', error);
        return res.status(500).json({ error: 'An internal server error occurred.' });
    }
}
