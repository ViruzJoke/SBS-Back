// /api/create-admin.js
// ใช้สำหรับสร้าง User Admin คนแรกเท่านั้น
// หลังจากใช้งานเสร็จแล้ว ควรลบไฟล์นี้ออก

import { sql } from '@vercel/postgres';
import bcrypt from 'bcrypt';

export default async function handler(req, res) {
    // ดึงข้อมูลจาก Environment Variables ที่เราตั้งค่าไว้ใน Vercel
    const username = process.env.ADMIN_USERNAME;
    const password = process.env.ADMIN_PASSWORD;
    const fullName = 'Admin User';

    if (!username || !password) {
        const errorMessage = 'ADMIN_USERNAME and ADMIN_PASSWORD must be set in Vercel Environment Variables.';
        console.error(errorMessage);
        return res.status(500).json({ error: errorMessage });
    }

    try {
        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(password, saltRounds);

        // เพิ่ม User ใหม่ลงในตาราง (ถ้ายังไม่มี)
        await sql`
            INSERT INTO dbs_users (username, password_hash, full_name)
            VALUES (${username}, ${passwordHash}, ${fullName})
            ON CONFLICT (username) DO NOTHING;
        `;

        res.status(200).json({ message: `User '${username}' created or already exists.` });
    } catch (error) {
        console.error('Error creating admin user:', error);
        res.status(500).json({ error: error.message });
    }
}
