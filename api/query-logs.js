// /api/query-logs.js
// Vercel Serverless Function for querying shipment logs
// v3 - Format timestamp in SQL to prevent timezone conversion

import { sql } from '@vercel/postgres';

const ALLOWED_ORIGIN = 'https://viruzjoke.github.io';

export default async function handler(req, res) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'GET') {
        res.setHeader('Allow', ['GET']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

    try {
        const { 
            trackingNumber, 
            bookingRef,
            shipperName, 
            receiverName, 
            reference, 
            accountNumber, 
            phone, 
            shipperCountry, 
            receiverCountry, 
            dateFrom, 
            dateTo, 
            timeFrom, 
            timeTo 
        } = req.query;

        // [FIX] Explicitly list columns and format the date using TO_CHAR.
        // This converts the timestamp to a plain string in the specified format
        // directly in the database, preventing any automatic timezone conversions.
        let query = `
            SELECT 
                log_id,
                log_type,
                request_reference,
                booking_ref,
                shipper_name,
                shipper_company,
                shipper_phone,
                shipper_country,
                shipper_account_number,
                receiver_name,
                receiver_company,
                receiver_phone,
                receiver_country,
                duty_account_number,
                respond_trackingnumber,
                respond_label,
                respond_receipt,
                respond_invoice,
                TO_CHAR(created_at, 'YYYY-MM-DD HH24:MI:SS') AS created_at
            FROM shipment_logs
        `;

        const whereClauses = [];
        const queryParams = [];
        let paramIndex = 1;

        if (trackingNumber) {
            whereClauses.push(`respond_trackingnumber ILIKE $${paramIndex++}`);
            queryParams.push(`%${trackingNumber.replace(/\*/g, '%')}%`);
        }
        
        if (bookingRef) {
            whereClauses.push(`booking_ref ILIKE $${paramIndex++}`);
            queryParams.push(`%${bookingRef.replace(/\*/g, '%')}%`);
        }

        if (shipperName) {
            whereClauses.push(`(shipper_name ILIKE $${paramIndex} OR shipper_company ILIKE $${paramIndex})`);
            queryParams.push(`%${shipperName.replace(/\*/g, '%')}%`);
            paramIndex++;
        }

        if (receiverName) {
            whereClauses.push(`(receiver_name ILIKE $${paramIndex} OR receiver_company ILIKE $${paramIndex})`);
            queryParams.push(`%${receiverName.replace(/\*/g, '%')}%`);
            paramIndex++;
        }

        if (reference) {
            whereClauses.push(`request_reference ILIKE $${paramIndex++}`);
            queryParams.push(`%${reference.replace(/\*/g, '%')}%`);
        }

        if (accountNumber) {
            whereClauses.push(`(shipper_account_number = $${paramIndex} OR duty_account_number = $${paramIndex})`);
            queryParams.push(accountNumber);
            paramIndex++;
        }

        if (phone) {
            whereClauses.push(`(shipper_phone ILIKE $${paramIndex} OR receiver_phone ILIKE $${paramIndex})`);
            queryParams.push(`%${phone}%`);
            paramIndex++;
        }
        
        if (shipperCountry) {
            whereClauses.push(`shipper_country ILIKE $${paramIndex++}`);
            queryParams.push(`${shipperCountry}%`);
        }

        if (receiverCountry) {
            whereClauses.push(`receiver_country ILIKE $${paramIndex++}`);
            queryParams.push(`${receiverCountry}%`);
        }

        // Note: This part now compares against the original 'created_at' column, not the formatted string.
        if (dateFrom && dateTo) {
            const startDateTime = timeFrom ? `${dateFrom} ${timeFrom}` : `${dateFrom} 00:00:00`;
            const endDateTime = timeTo ? `${dateTo} ${timeTo}` : `${dateTo} 23:59:59`;
            whereClauses.push(`created_at BETWEEN $${paramIndex++} AND $${paramIndex++}`);
            queryParams.push(startDateTime, endDateTime);
        } else if (dateFrom) {
            whereClauses.push(`created_at >= $${paramIndex++}`);
            queryParams.push(`${dateFrom} 00:00:00`);
        } else if (dateTo) {
            whereClauses.push(`created_at <= $${paramIndex++}`);
            queryParams.push(`${dateTo} 23:59:59`);
        }

        if (whereClauses.length > 0) {
            query += ' WHERE ' + whereClauses.join(' AND ');
        }

        query += ' ORDER BY created_at DESC';

        const { rows } = await sql.query(query, queryParams);

        res.status(200).json(rows);

    } catch (error) {
        console.error('Error querying logs:', error);
        res.status(500).json({ message: 'Internal Server Error', error: error.message });
    }
}
