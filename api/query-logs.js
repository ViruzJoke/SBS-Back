// /api/query-logs.js
// Vercel Serverless Function to query shipment logs from the database.
// v2 - Added country filters

import { sql } from '@vercel/postgres';

// [สำคัญ] เปลี่ยนค่านี้ให้เป็น URL ของหน้า Admin (DHL-Admin) ของคุณ
const ALLOWED_ORIGIN = 'https://viruzjoke.github.io/DHL-Admin'; 

export default async function handler(req, res) {
    // --- CORS Configuration ---
    res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    // --- Main Logic ---
    try {
        const { 
            trackingNumber, 
            shipperName, 
            receiverName, 
            reference, 
            shipperAccount, 
            shipperCountry, // [NEW] รับค่าประเทศผู้ส่ง
            receiverCountry, // [NEW] รับค่าประเทศผู้รับ
            dateFrom, 
            dateTo 
        } = req.query;

        let query = "SELECT * FROM shipment_logs";
        const conditions = [];
        const values = [];
        let valueIndex = 1;

        // --- สร้างเงื่อนไข (WHERE clause) แบบ Dynamic และปลอดภัย ---
        // การค้นหาด้วย Wildcard (*) จะถูกจัดการโดยการใช้ ILIKE และเครื่องหมาย %
        // ซึ่ง Frontend ไม่ต้องใส่ * มา แต่ Backend จะจัดการให้เอง
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
        if (shipperAccount) {
            conditions.push(`shipper_account_number ILIKE $${valueIndex++}`);
            values.push(`%${shipperAccount.replace(/\*/g, '%')}%`);
        }
        // [NEW] เพิ่มเงื่อนไขการค้นหาด้วยประเทศ
        if (shipperCountry) {
            conditions.push(`shipper_country ILIKE $${valueIndex++}`);
            values.push(`%${shipperCountry.replace(/\*/g, '%')}%`);
        }
        if (receiverCountry) {
            conditions.push(`receiver_country ILIKE $${valueIndex++}`);
            values.push(`%${receiverCountry.replace(/\*/g, '%')}%`);
        }
        if (dateFrom) {
            conditions.push(`created_at >= $${valueIndex++}`);
            values.push(`${dateFrom}T00:00:00.000Z`);
        }
        if (dateTo) {
            conditions.push(`created_at <= $${valueIndex++}`);
            values.push(`${dateTo}T23:59:59.999Z`);
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
