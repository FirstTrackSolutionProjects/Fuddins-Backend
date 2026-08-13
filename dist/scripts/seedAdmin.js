import dotenv from 'dotenv';
import sequelize from '../config/database.js';
import { ensureDatabase } from '../config/ensureDatabase.js';
import User from '../models/User.js';
import { hashPassword } from '../utils/password.js';
dotenv.config();
async function seedAdmin() {
    const name = process.env.ADMIN_NAME || 'Admin';
    const email = process.env.ADMIN_EMAIL || 'admin@example.com';
    const password = process.env.ADMIN_PASSWORD;
    if (!password) {
        throw new Error('ADMIN_PASSWORD is required to seed an admin user');
    }
    await ensureDatabase();
    await sequelize.authenticate();
    await sequelize.sync({ alter: true });
    const [user, created] = await User.findOrCreate({
        where: { email },
        defaults: {
            name,
            email,
            password: hashPassword(password),
            role: 'admin',
        },
    });
    if (!created) {
        await user.update({ name, password: hashPassword(password), role: 'admin' });
    }
    await sequelize.close();
    console.log(`${created ? 'Created' : 'Updated'} admin user: ${email}`);
}
seedAdmin().catch(async (error) => {
    console.error(error);
    await sequelize.close();
    process.exit(1);
});
