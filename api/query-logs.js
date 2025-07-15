// /api/query-logs.js
// Vercel Serverless Function to query shipment logs from the database.
// v4 - Added phone filter and refactored for clarity

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
            accountNumber, phone, shipperCountry, receiverCountry, 
            dateFrom, dateTo, timeFrom, timeTo
        } = req.query;

        let query = "SELECT * FROM shipment_logs";
        const conditions = [];
        const values = [];
        let valueIndex = 1;

        const addCondition = (clause, value) => {
            if (value) {
                conditions.push(clause.replace('?', `$${valueIndex++}`));
                values.push(value.includes('%') ? value : `%${value.replace(/\*/g, '%')}%`);
            }
        };

        addCondition('respond_trackingnumber ILIKE ?', trackingNumber);
        addCondition('request_reference ILIKE ?', reference);
        addCondition('shipper_country ILIKE ?', shipperCountry);
        addCondition('receiver_country ILIKE ?', receiverCountry);

        if (shipperName) {
            conditions.push(`(shipper_name ILIKE $${valueIndex++} OR shipper_company ILIKE $${valueIndex++})`);
            values.push(`%${shipperName.replace(/\*/g, '%')}%`, `%${shipperName.replace(/\*/g, '%')}%`);
        }
        if (receiverName) {
            conditions.push(`(receiver_name ILIKE $${valueIndex++} OR receiver_company ILIKE $${valueIndex++})`);
            values.push(`%${receiverName.replace(/\*/g, '%')}%`, `%${receiverName.replace(/\*/g, '%')}%`);
        }
        if (accountNumber) {
            conditions.push(`(shipper_account_number ILIKE $${valueIndex++} OR duty_account_number ILIKE $${valueIndex++})`);
            values.push(`%${accountNumber.replace(/\*/g, '%')}%`, `%${accountNumber.replace(/\*/g, '%')}%`);
        }
        if (phone) {
            conditions.push(`(shipper_phone ILIKE $${valueIndex++} OR receiver_phone ILIKE $${valueIndex++})`);
            values.push(`%${phone.replace(/\*/g, '%')}%`, `%${phone.replace(/\*/g, '%')}%`);
        }
        
        if (dateFrom) {
            const startDateTime = timeFrom ? `${dateFrom}T${timeFrom}:00` : `${dateFrom}T00:00:00`;
            conditions.push(`created_at >= $${valueIndex++}`);
            values.push(startDateTime);
        }
        if (dateTo) {
            const endDateTime = timeTo ? `${dateTo}T${timeTo}:59` : `${dateTo}T23:59:59`;
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
