const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");
const { NewMessage } = require("telegram/events");
const axios = require("axios");

// ===== SOZLAMALAR =====
const API_ID = 39537053;
const API_HASH = "3598ecf1a70cc2c3332eb89ae8ac8ec6";

const SESSION_STRING = "1AgAOMTQ5LjE1NC4xNjcuNTABu4/q6RoYHTYJgH+i42TXWWGYp5l3mi3MraB9iGheQb7UWraoluV6za/DROhd5SBlyvARZHDDhWaq5DqjQi76B5ODDXonEqzaB6s2muhfFLagdI8O4jKSljLB9bj0lxy2bE6loSfw5aa1FMKqPraYdRvqBskrkaxvdzhk7ivhfmp0XK4eNfE/3HeMv9IQxZ3r/Gah8syRH+7JCZBsj1+5GDuVLtmw5j46FK4Fkx+orZ7TEKKJTf4Umtw5C1aiR0maBq8INaF7jWR0cSP4NBxGpibW8FRlzafJVbeEN8xHaIdcQAksEQJ2ESEYGfLCPLGcYEd+HizqFcjb9MfnqICHY4g=";

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

  // Railway uchun alive
  await new Promise(() => {});
}

main().catch((e) => {
  console.error("❌ Fatal:", e);
});
