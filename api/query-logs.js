// /api/query-logs.js
// Vercel Serverless Function to query shipment logs from the database.
// v3 - Added time filter and combined account search

import { sql } from '@vercel/postgres';

const ALLOWED_ORIGIN = 'https://viruzjoke.github.io'; 

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    
    try {
        const { 
            trackingNumber, shipperName, receiverName, reference, 
            accountNumber, // [MODIFIED] รับค่า account รวม
            shipperCountry, receiverCountry, 
            dateFrom, dateTo,
            timeFrom, timeTo // [NEW] รับค่าเวลา
        } = req.query;

        let query = "SELECT * FROM shipment_logs";
        const conditions = [];
        const values = [];
        let valueIndex = 1;

        // --- สร้างเงื่อนไข (WHERE clause) แบบ Dynamic และปลอดภัย ---
        if (trackingNumber) {
            conditions.push(`respond_trackingnumber ILIKE $${valueIndex++}`);
            values.push(`%${trackingNumber.replace(/\*/g, '%')}%`);
        }
        if (shipperName) {
            conditions.push(`(shipper_name ILIKE $${valueIndex++} OR shipper_company ILIKE $${valueIndex++})`);
            values.push(`%${shipperName.replace(/\*/g, '%')}%`, `%${shipperName.replace(/\*/g, '%')}%`);
        }
        if (receiverName) {
            conditions.push(`(receiver_name ILIKE $${valueIndex++} OR receiver_company ILIKE $${valueIndex++})`);
            values.push(`%${receiverName.replace(/\*/g, '%')}%`, `%${receiverName.replace(/\*/g, '%')}%`);
        }
        if (reference) {
            conditions.push(`request_reference ILIKE $${valueIndex++}`);
            values.push(`%${reference.replace(/\*/g, '%')}%`);
        }
        // [MODIFIED] ค้นหาใน account ทั้งสองฟิลด์
        if (accountNumber) {
            conditions.push(`(shipper_account_number ILIKE $${valueIndex++} OR duty_account_number ILIKE $${valueIndex++})`);
            values.push(`%${accountNumber.replace(/\*/g, '%')}%`, `%${accountNumber.replace(/\*/g, '%')}%`);
        }
        if (shipperCountry) {
            conditions.push(`shipper_country ILIKE $${valueIndex++}`);
            values.push(`%${shipperCountry.replace(/\*/g, '%')}%`);
        }
        if (receiverCountry) {
            conditions.push(`receiver_country ILIKE $${valueIndex++}`);
            values.push(`%${receiverCountry.replace(/\*/g, '%')}%`);
        }
        if (dateFrom) {
            const startDateTime = timeFrom ? `${dateFrom}T${timeFrom}:00.000Z` : `${dateFrom}T00:00:00.000Z`;
            conditions.push(`created_at >= $${valueIndex++}`);
            values.push(startDateTime);
        }
        if (dateTo) {
            const endDateTime = timeTo ? `${dateTo}T${timeTo}:59.999Z` : `${dateTo}T23:59:59.999Z`;
            conditions.push(`created_at <= $${valueIndex++}`);
            values.push(endDateTime);
        }

        if (conditions.length > 0) {
            query += " WHERE " + conditions.join(" AND ");
        }

        query += " ORDER BY created_at DESC LIMIT 100;";

        const { rows } = await sql.query(query, values);
        
        res.status(200).json(rows);

    } catch (error) {
        console.error('Query Logs API error:', error);
        res.status(500).json({ message: 'An internal server error occurred.', details: error.message });
    }
}
