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
    console.log(`✅ API [${res.status}]:`, res.data);
  } catch (e) {
    console.error("❌ API xatolik:", e.message);
  }
}

async function main() {
  // Session: env → file → bo'sh
  let sessionString = "";
  if (process.env.SESSION_STRING) {
    sessionString = process.env.SESSION_STRING;
    console.log("🔑 Session env dan olindi.");
  } else if (fs.existsSync(SESSION_FILE)) {
    sessionString = fs.readFileSync(SESSION_FILE, "utf-8").trim();
    console.log("🔑 Session fayldan olindi.");
  }

  const session = new StringSession(sessionString);
  const client  = new TelegramClient(session, API_ID, API_HASH, {
    connectionRetries: 10,
    retryDelay: 3000,
    autoReconnect: true,
    requestRetries: 5,
  });

  const rl  = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = q => new Promise(r => rl.question(q, r));

  await client.start({
    phoneNumber: () => ask("📱 Telefon raqam (+998...): "),
    password:    () => ask("🔐 2FA parol (yo'q bo'lsa Enter): "),
    phoneCode:   () => ask("📩 SMS/Telegram kod: "),
    onError:     e  => console.error("Login xatolik:", e.message),
  });

  // Session saqlash
  const saved = client.session.save();
  fs.writeFileSync(SESSION_FILE, saved);
  console.log("\n✅ SESSION_STRING (Railway ga qo'shing):");
  console.log("─".repeat(40));
  console.log(saved);
  console.log("─".repeat(40) + "\n");

  rl.close();

  const me = await client.getMe();
  console.log(`✅ Ulandi: ${me.firstName} (@${me.username})`);
  console.log("📡 Xabarlar kutilmoqda...\n");

  client.addEventHandler(async (event) => {
    const msg = event.message;
    if (!msg?.text) return;

    const senderId = Number(msg.senderId);
    if (senderId !== TARGET_BOT_ID) return;

    const text = msg.text;
    console.log(`\n📨 Xabar:\n${text}`);

    const parsed = parseMessage(text);
    if (!parsed) {
      console.log("⏭️  Kerakli format emas.\n");
      return;
    }

    console.log(`💰 Summa: ${parsed.amount} | 💳 Karta: ${parsed.card}`);
    await sendToApi(parsed.amount, parsed.card);
    console.log("─".repeat(40));
  }, new NewMessage({}));

  process.on("SIGINT", async () => {
    console.log("\n🛑 To'xtatildi.");
    await client.disconnect();
    process.exit(0);
  });

  await client.catch(e => console.error("Client xatolik:", e));
}

main().catch(console.error);