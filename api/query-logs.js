// /api/query-logs.js
// Vercel Serverless Function to query shipment logs from the database.

import { sql } from '@vercel/postgres';

// [สำคัญ] เปลี่ยนค่านี้ให้เป็น URL ของหน้า Admin (DBS-Admin) ของคุณ
const ALLOWED_ORIGIN = 'https://viruzjoke.github.io';

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
        // ดึงค่า filter ต่างๆ จาก query parameters ของ URL
        const { 
            trackingNumber, 
            shipperName, 
            receiverName, 
            reference, 
            shipperAccount, 
            dateFrom, 
            dateTo 
        } = req.query;

        // เริ่มต้นสร้างคำสั่ง SQL
        let query = "SELECT * FROM shipment_logs";
        const conditions = [];
        const values = [];
        let valueIndex = 1;

        // --- สร้างเงื่อนไข (WHERE clause) แบบ Dynamic และปลอดภัย ---
        if (trackingNumber) {
            // ILIKE คือการค้นหาแบบ case-insensitive (ไม่สนใจตัวพิมพ์เล็ก/ใหญ่)
            conditions.push(`respond_trackingnumber ILIKE $${valueIndex++}`);
            values.push(`%${trackingNumber}%`);
        }
        if (shipperName) {
            conditions.push(`(shipper_name ILIKE $${valueIndex++} OR shipper_company ILIKE $${valueIndex++})`);
            values.push(`%${shipperName}%`, `%${shipperName}%`);
        }
        if (receiverName) {
            conditions.push(`(receiver_name ILIKE $${valueIndex++} OR receiver_company ILIKE $${valueIndex++})`);
            values.push(`%${receiverName}%`, `%${receiverName}%`);
        }
        if (reference) {
            conditions.push(`request_reference ILIKE $${valueIndex++}`);
            values.push(`%${reference}%`);
        }
        if (shipperAccount) {
            conditions.push(`shipper_account_number ILIKE $${valueIndex++}`);
            values.push(`%${shipperAccount}%`);
        }
        if (dateFrom) {
            // แปลงวันที่ให้เป็นเวลาเริ่มต้นของวันนั้นๆ
            conditions.push(`created_at >= $${valueIndex++}`);
            values.push(`${dateFrom}T00:00:00.000Z`);
        }
        if (dateTo) {
            // แปลงวันที่ให้เป็นเวลาสิ้นสุดของวันนั้นๆ
            conditions.push(`created_at <= $${valueIndex++}`);
            values.push(`${dateTo}T23:59:59.999Z`);
        }

        // ถ้่ามีเงื่อนไขอย่างน้อย 1 ข้อ ให้เพิ่ม WHERE เข้าไปใน query
        if (conditions.length > 0) {
            query += " WHERE " + conditions.join(" AND ");
        }

        // เรียงข้อมูลตามวันที่สร้างล่าสุด และจำกัดผลลัพธ์ไว้ที่ 100 รายการเพื่อประสิทธิภาพ
        query += " ORDER BY created_at DESC LIMIT 100;";

        // รันคำสั่ง SQL พร้อมค่าที่ปลอดภัย (Parameterized Query)
        const { rows } = await sql.query(query, values);
        
        // ส่งข้อมูลที่ได้กลับไปให้ Frontend
        res.status(200).json(rows);

    } catch (error) {
        console.error('Query Logs API error:', error);
        res.status(500).json({ message: 'An internal server error occurred.', details: error.message });
    }
}
