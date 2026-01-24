
const db = require('./backend/api_gateway/src/config/db');

const requiredFeatures = [
    'PEOPLE_COUNTING', 'MOTION', 'LINE_CROSSING', 'INTRUSION',
    'ILLEGAL_PARKING', 'FACE_RECOGNITION', 'FIRE_SMOKE',
    'TRAFFIC_VIOLATION', 'CRIMINAL_ACTIVITY'
];

async function verify() {
    try {
        console.log("Checking ai_features table...");
        const res = await db.query('SELECT code FROM ai_features');
        const existing = new Set(res.rows.map(r => r.code));

        console.log("Existing features:", Array.from(existing));

        const missing = requiredFeatures.filter(f => !existing.has(f));

        if (missing.length > 0) {
            console.log("MISSING FEATURES:", missing);
            // Insert them
            for (const code of missing) {
                console.log(`Inserting ${code}...`);
                await db.query(
                    `INSERT INTO ai_features (code, name, description, is_premium) 
                     VALUES ($1, $2, $3, false)`,
                    [code, code.replace('_', ' '), 'Auto-generated feature', false]
                );
            }
            console.log("All missing features inserted.");
        } else {
            console.log("All required features exist.");
        }
    } catch (e) {
        console.error("Error:", e);
    } finally {
        process.exit(0);
    }
}

verify();
