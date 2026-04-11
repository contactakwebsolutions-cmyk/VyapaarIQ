const db = require('../config/db');
const { processCommand: processBusinessCommand } = require('./businessLogicService');
const { modePrompt, modeConfirmPrompt } = require('./appModeMessages');
const { processPersonalIQMessage } = require('../personaliq/processCommand');
const { parseMessage } = require('./parserService');

async function getBusinessUser(phoneNumber, fallbackUser) {
    if (!phoneNumber) return fallbackUser;
    const res = await db.query('SELECT * FROM users WHERE phone_number = $1', [phoneNumber]);
    return res.rows[0] || fallbackUser;
}

async function getAppMode(phoneNumber) {
    const res = await db.query('SELECT app_mode FROM app_profiles WHERE phone_number = $1', [phoneNumber]);
    return res.rows[0]?.app_mode || null;
}

async function getLead(phoneNumber) {
    const res = await db.query('SELECT stage, pending_mode FROM app_mode_leads WHERE phone_number = $1', [phoneNumber]);
    return res.rows[0] || null;
}

async function upsertLead(phoneNumber, stage, pendingMode = null) {
    await db.query(`
        INSERT INTO app_mode_leads (phone_number, stage, pending_mode)
        VALUES ($1, $2, $3)
        ON CONFLICT (phone_number) DO UPDATE
        SET stage = EXCLUDED.stage, pending_mode = EXCLUDED.pending_mode
    `, [phoneNumber, stage, pendingMode]);
}

async function clearLead(phoneNumber) {
    await db.query('DELETE FROM app_mode_leads WHERE phone_number = $1', [phoneNumber]);
}

async function setProfile(phoneNumber, appMode) {
    await db.query(`
        INSERT INTO app_profiles (phone_number, app_mode)
        VALUES ($1, $2)
        ON CONFLICT (phone_number) DO NOTHING
    `, [phoneNumber, appMode]);
}

function isPACTIVATE(text) {
    return /^PACTIVATE\b/i.test((text || '').trim());
}

function isACTIVATE(text) {
    return /^ACTIVATE\b/i.test((text || '').trim());
}

async function routeMessage({ user, phoneNumber, text, businessCommandObj, subscriptionInfo }) {
    const rawText = (text || '').trim();
    const fromPhone = phoneNumber || user?.phone_number;
    if (!fromPhone) return '❌ Missing phone number';

    // PersonalIQ admin activation command (kept separate)
    if (isPACTIVATE(rawText)) {
        const businessUser = await getBusinessUser(fromPhone, user);
        const lang = businessUser?.language || 'english';
        return await processPersonalIQMessage({
            phoneNumber: fromPhone,
            language: lang,
            rawText,
            fromPhoneNumber: fromPhone
        });
    }

    // VyapaarIQ admin activation command should work regardless of app mode for ADMIN_PHONE.
    const adminPhone = (process.env.ADMIN_PHONE || '').trim();
    if (adminPhone && fromPhone === adminPhone && isACTIVATE(rawText)) {
        const businessUser = await getBusinessUser(fromPhone, user);
        const cmd = businessCommandObj || parseMessage(rawText);
        return await processBusinessCommand(businessUser, cmd, subscriptionInfo, rawText);
    }

    const businessUser = await getBusinessUser(fromPhone, user);
    const lang = businessUser?.language || null;

    const appMode = await getAppMode(fromPhone);
    if (appMode === 'business') {
        return await processBusinessCommand(businessUser, businessCommandObj, subscriptionInfo, rawText);
    }
    if (appMode === 'personal') {
        return await processPersonalIQMessage({
            phoneNumber: fromPhone,
            language: lang || 'english',
            rawText,
            fromPhoneNumber: fromPhone
        });
    }

    // No app selected yet.
    // If language isn't set yet, let existing onboarding finish (Business logic).
    if (!lang) {
        const response = await processBusinessCommand(businessUser, businessCommandObj, subscriptionInfo, rawText);

        // If the user just confirmed language, force app selection next.
        const refreshed = await getBusinessUser(fromPhone, businessUser);
        if (refreshed?.language) {
            await upsertLead(fromPhone, 'choose_app', null);
            return modePrompt(refreshed.language);
        }

        return response;
    }

    // Language is set, but mode isn't. Run app-mode onboarding.
    const lead = await getLead(fromPhone);
    const stage = lead?.stage || null;
    const pending = lead?.pending_mode || null;
    const upper = rawText.toUpperCase();

    if (!stage) {
        await upsertLead(fromPhone, 'choose_app', null);
        return modePrompt(lang);
    }

    if (stage === 'choose_app') {
        if (rawText === '1' || rawText === '2') {
            const pendingMode = rawText === '1' ? 'business' : 'personal';
            await upsertLead(fromPhone, 'confirm_app', pendingMode);
            return modeConfirmPrompt(lang, pendingMode);
        }
        return modePrompt(lang);
    }

    if (stage === 'confirm_app') {
        if (!pending) {
            await upsertLead(fromPhone, 'choose_app', null);
            return modePrompt(lang);
        }

        if (upper === 'YES') {
            await setProfile(fromPhone, pending);
            await clearLead(fromPhone);

            if (pending === 'business') {
                return await processBusinessCommand(
                    businessUser,
                    { command: 'WELCOME', sourceLang: lang === 'telugu' ? 'telugu' : 'english' },
                    subscriptionInfo,
                    'HELP'
                );
            }

            // Personal mode: initialize PersonalIQ user+trial and show welcome.
            return await processPersonalIQMessage({
                phoneNumber: fromPhone,
                language: lang,
                rawText: '',
                fromPhoneNumber: fromPhone
            });
        }

        if (upper === 'NO') {
            await upsertLead(fromPhone, 'choose_app', null);
            return modePrompt(lang);
        }

        return modeConfirmPrompt(lang, pending);
    }

    // Unknown stage fallback
    await clearLead(fromPhone);
    await upsertLead(fromPhone, 'choose_app', null);
    return modePrompt(lang);
}

module.exports = { routeMessage };
