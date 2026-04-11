function personalText(lang, key, params = {}) {
    const en = {
        welcome:
            "🚀 *Welcome to PersonalIQ*\n" +
            "_Simple. Private. Daily-friendly._\n\n" +
            "Track your personal money with these commands:\n\n" +
            "1️⃣ *Income*\n" +
            "• `I 30000 salary`\n\n" +
            "2️⃣ *Expenses*\n" +
            "• `E 200 food`\n\n" +
            "3️⃣ *Reports*\n" +
            "• `daily`  • `weekly`  • `monthly`  • `yearly`\n" +
            "💡 Add `pdf` to get a document\n\n" +
            "4️⃣ *Control*\n" +
            "• `undo`\n\n" +
            "💡 *Pro Tip*: You can send multiple entries at once (put each on a new line):\n" +
            "• `I 20000 bonus`\n" +
            "• `E 500 petrol`\n" +
            "• `E 200 dinner`\n\n" +
            "--------------------------\n" +
            "📈 *PersonalIQ* - Clarity & Control",
        income_added: "💰 Income added: ₹{amount}",
        expense_added: "💸 Expense added: ₹{amount}",
        undo_success: "↩️ Last entry removed",
        undo_none: "❌ No recent entry to undo",
        no_data: "📊 No data available",
        summary_title: "📊 Personal Summary:",
        weekly_title: "📊 Weekly Summary:",
        monthly_title: "📊 Monthly Summary:",
        yearly_title: "📊 Yearly Summary:",
        balance: "Balance: ₹{amount}",
        today_total: "Today Expense: ₹{today} | Total Expense: ₹{total}",
        net_metrics_title: "📊 *Net Metrics (All-time)*",
        net_income: "Net Income",
        net_expenditure: "Net Expenditure",
        net_balance: "Net Balance",
        top: "Top: {category} ₹{amount}",
        status: "Status: {message}",
        status_no_expenses: "🟢 No expenses yet",
        status_good_savings: "✅ Good savings",
        status_control: "👍 Spending is under control",
        status_spending_lot: "⚠️ You are spending a lot",
        pay_title: "⚠️ Your PersonalIQ trial has ended",
        pay_intro_pricing_block:
            "PersonalIQ\n" +
            "🚀 *Introductory Pricing*\n\n" +
            "Pro ⭐ Recommended\n" +
            "₹149 ❌\n" +
            "₹99",
        pay_choose: "Choose a plan:",
        pay_standard: "",
        pay_pro: "🟣 Pro – ₹99/month (Daily + Weekly/Monthly/Yearly)",
        pay_via_upi: "💳 Pay via UPI:",
        or_pay_using: "Or pay using:",
        upi_id_label: "• UPI ID:",
        mobile_label: "• Mobile:",
        pay_after: "After payment, send: PAID pro",
        paid_received: "✅ Payment notification received. Admin will activate your plan soon.",
        upgrade_required: "🔒 Upgrade required (Pro).",
        unauthorized: "❌ Unauthorized command",
        admin_success: "✅ Success! Activated {plan} until {date} for {phone}.",
        sub_activated_title: "✅ Subscription activated",
        sub_plan_label: "Plan",
        sub_valid_till_label: "Valid till",
        sub_thanks: "🎉 Thank you for your payment",
        err_use_telugu_cmds: "❌ Please use Telugu commands when language is set to Telugu.",
        err_use_english_cmds: "❌ Please use English commands when language is set to English."
    };

    const te = {
        welcome:
            "🚀 *PersonalIQ కు స్వాగతం*\n" +
            "_సరళం. ప్రైవేట్. రోజూ ఉపయోగించుకునేది._\n\n" +
            "మీ వ్యక్తిగత డబ్బును ఈ కమాండ్లతో ట్రాక్ చేయండి:\n\n" +
            "1️⃣ *ఆదాయం*\n" +
            "• `ఆ 30000 జీతం`\n\n" +
            "2️⃣ *ఖర్చులు*\n" +
            "• `ఖ 200 ఫుడ్`\n\n" +
            "3️⃣ *నివేదికలు*\n" +
            "• `ఈరోజు`  • `వారం`  • `నెల`  • `ఏడాది`\n" +
            "💡 `pdf` జోడిస్తే డాక్యుమెంట్ వస్తుంది\n\n" +
            "4️⃣ *కంట్రోల్*\n" +
            "• `వెనక్కి`\n\n" +
            "💡 *టిప్*: మీరు ఒకేసారి ఒకటి కంటే ఎక్కువ ఎంట్రీలను పంపవచ్చు (ప్రతిదీ కొత్త లైన్‌లో రాయండి):\n" +
            "• `ఆ 20000 బోనస్`\n" +
            "• `ఖ 500 పెట్రోల్`\n" +
            "• `ఖ 200 డిన్నర్`\n\n" +
            "--------------------------\n" +
            "📈 *PersonalIQ* - క్లారిటీ & కంట్రోల్",
        income_added: "💰 ఆదాయం జోడించబడింది: ₹{amount}",
        expense_added: "💸 ఖర్చు జోడించబడింది: ₹{amount}",
        undo_success: "↩️ చివరి ఎంట్రీ తొలగించబడింది",
        undo_none: "❌ undo చేయడానికి ఇటీవల ఎంట్రీ లేదు",
        no_data: "📊 డేటా అందుబాటులో లేదు",
        summary_title: "📊 వ్యక్తిగత సారాంశం:",
        weekly_title: "📊 వారపు సారాంశం:",
        monthly_title: "📊 నెలవారీ సారాంశం:",
        yearly_title: "📊 వార్షిక సారాంశం:",
        balance: "బ్యాలెన్స్: ₹{amount}",
        today_total: "ఈరోజు ఖర్చు: ₹{today} | మొత్తం ఖర్చు: ₹{total}",
        net_metrics_title: "📊 *నెట్ మెట్రిక్స్ (మొత్తం)*",
        net_income: "మొత్తం ఆదాయం",
        net_expenditure: "మొత్తం ఖర్చు",
        net_balance: "మొత్తం నిల్వ",
        top: "టాప్: {category} ₹{amount}",
        status: "స్థితి: {message}",
        status_no_expenses: "🟢 ఇంకా ఖర్చులు లేవు",
        status_good_savings: "✅ మంచి సేవింగ్స్",
        status_control: "👍 ఖర్చు నియంత్రణలో ఉంది",
        status_spending_lot: "⚠️ ఎక్కువగా ఖర్చు చేస్తున్నారు",
        pay_title: "⚠️ మీ PersonalIQ ట్రయల్ ముగిసింది",
        pay_intro_pricing_block:
            "PersonalIQ\n" +
            "🚀 *ప్రారంభ ఆఫర్ ధరలు*\n\n" +
            "ప్రో ⭐ సిఫారసు చేయబడినది\n" +
            "₹149 ❌\n" +
            "₹99",
        pay_choose: "ప్లాన్ ఎంచుకోండి:",
        pay_standard: "",
        pay_pro: "🟣 ప్రో – ₹99/నెల (daily + weekly/monthly/yearly)",
        pay_via_upi: "💳 UPI ద్వారా చెల్లించండి:",
        or_pay_using: "లేదా వీటిని ఉపయోగించండి:",
        upi_id_label: "• UPI ID:",
        mobile_label: "• మొబైల్:",
        pay_after: "చెల్లింపు తర్వాత పంపండి: PAID pro",
        paid_received: "✅ చెల్లింపు సమాచారం అందింది. అడ్మిన్ త్వరలో ప్లాన్ యాక్టివేట్ చేస్తారు.",
        upgrade_required: "🔒 ప్రోకి అప్‌గ్రేడ్ చేయాలి.",
        unauthorized: "❌ అనుమతి లేదు",
        admin_success: "✅ సక్సెస్! {phone} కి {date} వరకు {plan} యాక్టివేట్ అయింది.",
        sub_activated_title: "✅ సబ్‌స్క్రిప్షన్ యాక్టివేట్ అయింది",
        sub_plan_label: "ప్లాన్",
        sub_valid_till_label: "చెల్లుబాటు అయ్యే తేదీ",
        sub_thanks: "🎉 మీ చెల్లింపుకు ధన్యవాదాలు",
        err_use_telugu_cmds: "❌ భాష తెలుగులో ఉన్నప్పుడు తెలుగు ఆదేశాలను మాత్రమే ఉపయోగించండి.",
        err_use_english_cmds: "❌ భాష ఇంగ్లీష్ లో ఉన్నప్పుడు ఇంగ్లీష్ ఆదేశాలను మాత్రమే ఉపయోగించండి."
    };

    const dict = lang === 'telugu' ? te : en;
    let message = dict[key] || en[key] || key;
    for (const [k, v] of Object.entries(params)) {
        message = message.replace(`{${k}}`, v);
    }
    return message;
}

module.exports = { personalText };
