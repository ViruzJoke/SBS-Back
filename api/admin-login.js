// /api/admin-login.js
// API สำหรับตรวจสอบการ Login

import { sql } from '@vercel/postgres';
import bcrypt from 'bcrypt';

// [สำคัญ] แก้ไข URL นี้ให้เป็น URL ของหน้า Admin ของคุณ
const ALLOWED_ORIGINS = [
    'https://viruzjoke.github.io',
    'https://thcfit.duckdns.org',      // แก้ไข: เพิ่ม https://
    'https://thcfit-admin.duckdns.org' // แก้ไข: เพิ่ม https://
];

export default async function handler(req, res) {
    // --- ส่วนของ CORS ที่แก้ไข ---
    // 1. ย้ายโค้ดเข้ามาใน handler
    const origin = req.headers.origin;
    if (ALLOWED_ORIGINS.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }
    // ---------------------------

    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ message: 'Username and password are required.' });
        }

        // ค้นหา user จาก database
        const { rows } = await sql`SELECT * FROM dbs_users WHERE username = ${username};`;

        if (rows.length === 0) {
            return res.status(401).json({ message: 'Invalid username or password.' });
        }

        const user = rows[0];
        // เปรียบเทียบรหัสผ่านที่ส่งมากับ hash ใน database
        const passwordMatch = await bcrypt.compare(password, user.password_hash);

        if (!passwordMatch) {
            return res.status(401).json({ message: 'Invalid username or password.' });
        }

        // ถ้า Login สำเร็จ
        res.status(200).json({ message: 'Login successful.' });

    } catch (error) {
        console.error('Login API error:', error);
        res.status(500).json({ message: 'An internal server error occurred.' });
    }
}
