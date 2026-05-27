const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");
const { NewMessage } = require("telegram/events");
const axios = require("axios");
const readline = require("readline");
const fs = require("fs");
const path = require("path");

// === SOZLAMALAR ===
const API_ID        = 12669123;
const API_HASH      = "a70dc22137b5cdbbe760f1a58e2719a7";
const TARGET_BOT_ID = 856254490;
const API_URL       = "https://connectuz.uz/api.php";
const SESSION_FILE  = path.join(__dirname, "session.txt");
// ==================

function cleanText(str) {
  return str.replace(/[*_~`]/g, "").trim();
}

function parseMessage(text) {
  const lines = text.split("\n").map(l => cleanText(l)).filter(Boolean);
  if (!lines.length || !lines[0].includes("🎉 To'ldirish")) return null;
  if (lines.length < 4) return null;

  const amountRaw = lines[1].replace(/[^\d]/g, "");
  if (amountRaw.length < 3) return null;
  const amount = parseInt(amountRaw.slice(0, -2), 10);

  const card = lines[3].replace(/[^\d]/g, "");
  if (!card) return null;

  return { amount, card };
}

async function sendToApi(amount, card) {
  const url = `${API_URL}?amount=${amount}&card=${card}`;
  try {
    const res = await axios.get(url, { timeout: 10000 });
    console.log(`✅ API [${res.status}]:`, JSON.stringify(res.data));
  } catch (e) {
    console.error("❌ API xatolik:", e.message);
  }
}

async function main() {
  let sessionString = "";
  if (process.env.SESSION_STRING) {
    sessionString = process.env.SESSION_STRING;
  } else if (fs.existsSync(SESSION_FILE)) {
    sessionString = fs.readFileSync(SESSION_FILE, "utf-8").trim();
  }

  const session = new StringSession(sessionString);
  const client  = new TelegramClient(session, API_ID, API_HASH, {
    connectionRetries: 5,
    retryDelay: 3000,
    autoReconnect: true,
  });

  const rl  = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = q => new Promise(r => rl.question(q, r));

  await client.start({
    phoneNumber: () => ask("📱 Telefon raqam: "),
    password:    () => ask("🔐 2FA parol: "),
    phoneCode:   () => ask("📩 Kod: "),
    onError:     e  => console.error("Xatolik:", e.message),
  });

  const saved = client.session.save();
  fs.writeFileSync(SESSION_FILE, saved);
  console.log("\n✅ SESSION_STRING:\n" + saved + "\n");
  rl.close();

  const me = await client.getMe();
  console.log(`✅ Ulandi: ${me.firstName}`);
  console.log("📡 Kutilmoqda...\n");

  client.addEventHandler(async (event) => {
    const msg = event.message;
    if (!msg?.text) return;

    const senderId = Number(msg.senderId);
    if (senderId !== TARGET_BOT_ID) return;

    const text = msg.text;
    console.log(`📨 Xabar:\n${text}`);

    const parsed = parseMessage(text);
    if (!parsed) {
      console.log("⏭️  Format emas.\n");
      return;
    }

    console.log(`💰 ${parsed.amount} | 💳 ${parsed.card}`);
    await sendToApi(parsed.amount, parsed.card);
  }, new NewMessage({}));

  process.on("SIGINT", async () => {
    await client.disconnect();
    process.exit(0);
  });

  // Doimiy ushlab turish
  await new Promise(() => {});
}

main().catch(e => {
  console.error("Fatal:", e.message);
  process.exit(1);
});