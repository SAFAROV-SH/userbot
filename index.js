const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");
const { NewMessage } = require("telegram/events");
const axios = require("axios");

// ===== SOZLAMALAR =====
const API_ID = 39537053;
const API_HASH = "3598ecf1a70cc2c3332eb89ae8ac8ec6";
const SESSION_STRING = "1AgAOMTQ5LjE1NC4xNjcuNTABu4/q6RoYHTYJgH+i42TXWWGYp5l3mi3MraB9iGheQb7UWraoluV6za/DROhd5SBlyvARZHDDhWaq5DqjQi76B5ODDXonEqzaB6s2muhfFLagdI8O4jKSljLB9bj0lxy2bE6loSfw5aa1FMKqPraYdRvqBskrkaxvdzhk7ivhfmp0XK4eNfE/3HeMv9IQxZ3r/Gah8syRH+7JCZBsj1+5GDuVLtmw5j46FK4Fkx+orZ7TEKKJTf4Umtw5C1aiR0maBq8INaF7jWR0cSP4NBxGpibW8FRlzafJVbeEN8xHaIdcQAksEQJ2ESEYGfLCPLGcYEd+HizqFcjb9MfnqICHY4g=";
const TARGET_BOT_ID = 856254490;
const API_URL = "https://connectuz.uz/userbot/okpay.php";
// ======================

let client = null;
let isReconnecting = false;
let lastEventAt = Date.now();

function timestamp() {
  return new Date().toISOString();
}

function cleanText(str) {
  return str.replace(/[*_~`]/g, "").trim();
}

function parseMessage(text) {
  const lines = text
    .split("\n")
    .map((l) => cleanText(l))
    .filter(Boolean);
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
  const url = `${API_URL}?amount=${amount}&card=${card}&key=change_me_okpay_secret_2026`;
  try {
    const res = await axios.get(url, { timeout: 10000 });
    console.log(`✅ API [${res.status}]`, res.data);
  } catch (e) {
    console.error(`❌ [${timestamp()}] API xatolik:`, e.message);
  }
}

async function handleMessage(event) {
  try {
    lastEventAt = Date.now();
    const msg = event.message;
    if (!msg?.text) return;
    if (Number(msg.senderId) !== TARGET_BOT_ID) return;
    console.log(`📨 [${timestamp()}] Xabar:\n${msg.text}\n`);
    const parsed = parseMessage(msg.text);
    if (!parsed) {
      console.log("⏭️ Mos format emas\n");
      return;
    }
    console.log(`💰 Summa: ${parsed.amount}`);
    console.log(`💳 Karta: ${parsed.card}\n`);
    await sendToApi(parsed.amount, parsed.card);
  } catch (e) {
    console.error(`❌ [${timestamp()}] Handler xato:`, e.message);
  }
}

async function connect() {
  if (isReconnecting) return;
  isReconnecting = true;
  try {
    await client.connect();
    console.log(`✅ [${timestamp()}] Ulandi.`);
  } catch (e) {
    console.error(`❌ [${timestamp()}] Ulanish xato:`, e.message);
  } finally {
    isReconnecting = false;
  }
}

async function main() {
  client = new TelegramClient(
    new StringSession(SESSION_STRING),
    API_ID,
    API_HASH,
    { connectionRetries: 10, retryDelay: 3000, autoReconnect: true }
  );

  console.log(`🔌 [${timestamp()}] Ulanmoqda...`);
  await connect();
  const me = await client.getMe();
  console.log(`✅ [${timestamp()}] Ulandi: ${me.firstName}`);
  console.log("📡 Kutilmoqda...\n");

  client.addEventHandler(handleMessage, new NewMessage({}));

  // Har 30 sekundda ulanish holatini tekshirish
  setInterval(async () => {
    if (client && !client.connected) {
      console.warn(`⚠️ [${timestamp()}] Ulanish uzildi. Qayta ulanmoqda...`);
      await connect();
    }
  }, 30 * 1000);

  // Har 5 daqiqada heartbeat
  setInterval(() => {
    const idle = Math.round((Date.now() - lastEventAt) / 60000);
    console.log(`💓 [${timestamp()}] Tirik | connected: ${client?.connected} | idle: ${idle} daq`);
  }, 5 * 60 * 1000);

  await new Promise(() => {});
}

process.on("uncaughtException", (err) => {
  console.error(`❌ [${timestamp()}] uncaughtException:`, err.message);
});

process.on("unhandledRejection", (reason) => {
  console.error(`❌ [${timestamp()}] unhandledRejection:`, reason);
});

process.on("SIGINT", async () => {
  console.log(`⛔ [${timestamp()}] SIGINT. To'xtatilmoqda...`);
  try { await client?.disconnect(); } catch {}
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log(`⛔ [${timestamp()}] SIGTERM (Railway). To'xtatilmoqda...`);
  try { await client?.disconnect(); } catch {}
  process.exit(0);
});

main().catch((e) => {
  console.error(`❌ [${timestamp()}] Fatal:`, e.message);
  setTimeout(() => main().catch((e2) => {
    console.error(`❌ [${timestamp()}] Qayta urinish muvaffaqiyatsiz:`, e2.message);
  }), 10000);
});
