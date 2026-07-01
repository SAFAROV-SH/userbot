const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");
const { NewMessage } = require("telegram/events");
const axios = require("axios");

// ===== SOZLAMALAR =====
const API_ID = 39537053;
const API_HASH = "3598ecf1a70cc2c3332eb89ae8ac8ec6";
const SESSION_STRING = "1AgAOMTQ5LjE1NC4xNjcuNTABu4/q6RoYHTYJgH+i42TXWWGYp5l3mi3MraB9iGheQb7UWraoluV6za/DROhd5SBlyvARZHDDhWaq5DqjQi76B5ODDXonEqzaB6s2muhfFLagdI8O4jKSljLB9bj0lxy2bE6loSfw5aa1FMKqPraYdRvqBskrkaxvdzhk7ivhfmp0XK4eNfE/3HeMv9IQxZ3r/Gah8syRH+7JCZBsj1+5GDuVLtmw5j46FK4Fkx+orZ7TEKKJTf4Umtw5C1aiR0maBq8INaF7jWR0cSP4NBxGpibW8FRlzafJVbeEN8xHaIdcQAksEQJ2ESEYGfLCPLGcYEd+HizqFcjb9MfnqICHY4g=";
const TARGET_BOT_ID = 856254490;
const API_URL = "https://connectuz.uz/userbot/okpay.php?key=change_me_okpay_secret_2026";
const HEARTBEAT_INTERVAL_MS = 5 * 60 * 1000; // 5 daqiqada bir "tirikman" deb log yozish
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

// ---- Saved Messages orqali oxirgi ko'rilgan message_id ni saqlash ----
// Railway restart bo'lganda fayl tizimi o'chadi, shuning uchun
// Telegram'ning o'zidagi "Saved Messages" ga yozib saqlaymiz.
const SAVED_MSG_TAG = "#userbot_last_id";

async function getLastSeenId() {
  try {
    const msgs = await client.getMessages("me", { limit: 20, search: SAVED_MSG_TAG });
    if (!msgs || msgs.length === 0) return 0;
    // Eng so'nggi yozuvni ol
    const text = msgs[0].text || "";
    const match = text.match(/#userbot_last_id:(\d+)/);
    if (!match) return 0;
    const id = parseInt(match[1], 10);
    console.log(`📖 [${timestamp()}] Oxirgi ko'rilgan message_id: ${id}`);
    return id;
  } catch (e) {
    console.error(`❌ [${timestamp()}] getLastSeenId xato:`, e.message);
    return 0;
  }
}

async function saveLastSeenId(id) {
  try {
    await client.sendMessage("me", {
      message: `${SAVED_MSG_TAG}:${id}`,
    });
  } catch (e) {
    console.error(`❌ [${timestamp()}] saveLastSeenId xato:`, e.message);
  }
}

// Ishga tushganda o'tkazib yuborilgan xabarlarni tekshiradi
async function checkMissedMessages() {
  try {
    const lastId = await getLastSeenId();
    console.log(`🔍 [${timestamp()}] O'tkazib yuborilgan xabarlar tekshirilmoqda (id > ${lastId})...`);

    const msgs = await client.getMessages(TARGET_BOT_ID, { limit: 20 });
    if (!msgs || msgs.length === 0) {
      console.log(`ℹ️ [${timestamp()}] O'tkazib yuborilgan xabar yo'q.`);
      return;
    }

    // Eski dan yangi ga tartiblash
    const sorted = [...msgs].reverse();
    let maxId = lastId;
    let found = 0;

    for (const msg of sorted) {
      if (!msg.text) continue;
      if (msg.id <= lastId) continue;
      maxId = Math.max(maxId, msg.id);

      const senderId = Number(msg.senderId);
      if (senderId !== TARGET_BOT_ID) continue;

      console.log(`📨 [MISSED] id:${msg.id}\n${msg.text}\n`);
      const parsed = parseMessage(msg.text);
      if (!parsed) {
        console.log("⏭️ Mos format emas\n");
        continue;
      }
      found++;
      console.log(`💰 Summa: ${parsed.amount}`);
      console.log(`💳 Karta: ${parsed.card}\n`);
      await sendToApi(parsed.amount, parsed.card);
    }

    if (maxId > lastId) {
      await saveLastSeenId(maxId);
    }
    console.log(`✅ [${timestamp()}] Tekshiruv tugadi. ${found} ta o'tkazib yuborilgan xabar qayta ishlandi.\n`);
  } catch (e) {
    console.error(`❌ [${timestamp()}] checkMissedMessages xato:`, e.message);
  }
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

async function handleMessage(event) {
  try {
    lastEventAt = Date.now();
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
    await saveLastSeenId(msg.id);
  } catch (e) {
    console.error(`❌ [${timestamp()}] Handler xato:`, e.message);
  }
}

async function startClient() {
  client = new TelegramClient(
    new StringSession(SESSION_STRING),
    API_ID,
    API_HASH,
    {
      connectionRetries: 10,
      retryDelay: 3000,
      autoReconnect: true,
      // GramJS ulanish uzilganda o'zi avtomatik qayta ulanishga harakat qiladi
      // (autoReconnect: true tufayli), lekin bu jarayonni o'zimiz ham kuzatamiz
    }
  );

  // ---- Ulanish holati event'lari ----
  // GramJS o'z ichida "disconnect" / xato eventlarini chiqarmaydi standart
  // tarzda barcha versiyalarda, shuning uchun biz buni connect/keep-alive
  // sikli orqali tashqaridan kuzatamiz (pastdagi monitorConnection funksiyasi).

  console.log(`🔌 [${timestamp()}] Ulanmoqda...`);
  await client.connect();
  const me = await client.getMe();
  console.log(`✅ [${timestamp()}] Ulandi: ${me.firstName}`);
  console.log("📡 Kutilmoqda...\n");

  // O'tkazib yuborilgan xabarlarni tekshiramiz (restart vaqtida kelganlar)
  await checkMissedMessages();

  client.addEventHandler(handleMessage, new NewMessage({}));

  lastEventAt = Date.now();
}

// Ulanish hali tirikligini davriy tekshirib turadi.
// Agar GramJS clienti "connected" emas deb hisoblasa, qayta ulanishga
// majburlaydi (autoReconnect har doim ham yetarli bo'lavermaydi).
async function monitorConnection() {
  if (isReconnecting) return;
  try {
    if (client && typeof client.connected !== "undefined" && !client.connected) {
      isReconnecting = true;
      console.warn(`⚠️ [${timestamp()}] Ulanish uzilgan ko'rinadi. Qayta ulanishga harakat qilinmoqda...`);
      try {
        await client.connect();
        console.log(`✅ [${timestamp()}] Qayta ulandi.`);
      } catch (reconnectErr) {
        console.error(`❌ [${timestamp()}] Qayta ulanish muvaffaqiyatsiz:`, reconnectErr.message);
      } finally {
        isReconnecting = false;
      }
    }
  } catch (e) {
    console.error(`❌ [${timestamp()}] monitorConnection xato:`, e.message);
    isReconnecting = false;
  }
}

// Har HEARTBEAT_INTERVAL_MS da bir marta "process tirik" deb log yozadi.
// Bu Railway logida process qachon jim qolganini aniq ko'rsatadi.
function startHeartbeat() {
  setInterval(() => {
    const idleMinutes = Math.round((Date.now() - lastEventAt) / 60000);
    const connState = client && typeof client.connected !== "undefined" ? client.connected : "noma'lum";
    console.log(`💓 [${timestamp()}] Heartbeat — process tirik. Ulanish holati: ${connState}. Oxirgi xabardan beri: ${idleMinutes} daqiqa.`);
  }, HEARTBEAT_INTERVAL_MS);
}

// ---- Global xato ushlagichlar ----
// Bular bo'lmasa, kutilmagan xato butun process'ni jimgina yiqitadi va
// Railway buni "Stopping Container" deb ko'rsatadi, sabab esa logda
// ko'rinmay qoladi.
process.on("uncaughtException", (err) => {
  console.error(`❌ [${timestamp()}] uncaughtException:`, err);
  // Process'ni o'limga olib bormaymiz — Railway "On Failure" siyosati
  // bilan ham, xato bilan chiqib ketishimiz keraksiz qayta ishga
  // tushirishlarni keltirib chiqaradi. Buning o'rniga davom etamiz.
});

process.on("unhandledRejection", (reason, promise) => {
  console.error(`❌ [${timestamp()}] unhandledRejection:`, reason);
});

process.on("exit", (code) => {
  console.log(`🛑 [${timestamp()}] Process tugadi. Exit code: ${code}`);
});

process.on("SIGINT", async () => {
  console.log(`⛔ [${timestamp()}] SIGINT qabul qilindi. To'xtatilmoqda...`);
  if (client) {
    try {
      await client.disconnect();
    } catch (e) {
      console.error("Disconnect xato:", e.message);
    }
  }
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log(`⛔ [${timestamp()}] SIGTERM qabul qilindi (Railway konteynerni to'xtatyapti). To'xtatilmoqda...`);
  if (client) {
    try {
      await client.disconnect();
    } catch (e) {
      console.error("Disconnect xato:", e.message);
    }
  }
  process.exit(0);
});

async function main() {
  await startClient();
  startHeartbeat();
  setInterval(monitorConnection, 30 * 1000); // har 30 sekundda ulanishni tekshirish

  // Railway uchun process'ni tirik ushlab turish
  await new Promise(() => {});
}

main().catch((e) => {
  console.error(`❌ [${timestamp()}] Fatal:`, e);
  // Fatal xato bo'lsa ham, process'ni o'limga olib bormaymiz —
  // chunki Restart Policy "On Failure" bo'lgani uchun bu qayta-qayta
  // restart sikliga olib kelishi mumkin. Buning o'rniga xatoni
  // ko'rsatib, qayta urinib ko'ramiz.
  setTimeout(() => {
    console.log(`🔄 [${timestamp()}] main() qayta ishga tushirilmoqda...`);
    main().catch((e2) => console.error(`❌ [${timestamp()}] Qayta urinish ham muvaffaqiyatsiz:`, e2));
  }, 10000);
});
