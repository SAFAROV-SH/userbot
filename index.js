
const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");
const { NewMessage } = require("telegram/events");
const axios = require("axios");

// ===== SOZLAMALAR =====
const API_ID = Number(process.env.API_ID);
const API_HASH = process.env.API_HASH;
const SESSION_STRING = process.env.SESSION_STRING;

const TARGET_BOT_ID = 856254490;
const API_URL = "https://connectuz.uz/api.php";
// ======================

function cleanText(str) {
  return str.replace(/[*_~`]/g, "").trim();
}

function parseMessage(text) {
  const lines = text
    .split("\n")
    .map((l) => cleanText(l))
    .filter(Boolean);

  if (!lines.length || !lines[0].includes("🎉 To'ldirish")) {
    return null;
  }

  if (lines.length < 4) {
    return null;
  }

  const amountRaw = lines[1].replace(/[^\d]/g, "");

  if (amountRaw.length < 3) {
    return null;
  }

  const amount = parseInt(amountRaw.slice(0, -2), 10);

  const card = lines[3].replace(/[^\d]/g, "");

  if (!card) {
    return null;
  }

  return { amount, card };
}

async function sendToApi(amount, card) {
  const url = `${API_URL}?amount=${amount}&card=${card}`;

  try {
    const res = await axios.get(url, {
      timeout: 10000,
    });

    console.log(`✅ API [${res.status}]`, res.data);
  } catch (e) {
    console.error("❌ API xatolik:", e.message);
  }
}

async function main() {
  if (!API_ID || !API_HASH || !SESSION_STRING) {
    console.log("❌ ENV yo'q");
    process.exit(1);
  }

  const client = new TelegramClient(
    new StringSession(SESSION_STRING),
    API_ID,
    API_HASH,
    {
      connectionRetries: 5,
      retryDelay: 3000,
      autoReconnect: true,
    }
  );

  console.log("🔌 Ulanmoqda...");

  await client.connect();

  const me = await client.getMe();

  console.log(`✅ Ulandi: ${me.firstName}`);
  console.log("📡 Kutilmoqda...\n");

  client.addEventHandler(
    async (event) => {
      try {
        const msg = event.message;

        if (!msg?.text) return;

        const senderId = Number(msg.senderId);

        if (senderId !== TARGET_BOT_ID) return;

        const text = msg.text;

        console.log(`📨 Xabar:\n${text}\n`);

        const parsed = parseMessage(text);

        if (!parsed) {
          console.log("⏭️ Mos format emas\n");
          return;
        }

        console.log(`💰 Summa: ${parsed.amount}`);
        console.log(`💳 Karta: ${parsed.card}\n`);

        await sendToApi(parsed.amount, parsed.card);
      } catch (e) {
        console.error("❌ Handler xato:", e.message);
      }
    },
    new NewMessage({})
  );

  process.on("SIGINT", async () => {
    console.log("⛔ To'xtatilmoqda...");
    await client.disconnect();
    process.exit(0);
  });

  // Railway uchun alive ushlab turadi
  await new Promise(() => {});
}

main().catch((e) => {
  console.error("❌ Fatal:", e);
});
```
