import TelegramBot from "node-telegram-bot-api";
import crypto from "crypto";

const BOT_TOKEN = process.env.BOT_TOKEN;
if (!BOT_TOKEN) {
  console.error("[FATAL] BOT_TOKEN environment variable is not set");
  process.exit(1);
}

const ADMIN_USERNAME = (process.env.TELEGRAM_ADMIN_USERNAME || "Aamoviesadmin").replace("@", "").toLowerCase();
const CHANNEL_ID = process.env.TELEGRAM_CHANNEL_ID || "@aamoviesofficial";
const REPLIT_SERVER = "https://sheer-id-verify.replit.app";
const BOT_API_SECRET = process.env.BOT_TOKEN;
const VERIFICATION_COST = 50;
const JOIN_REWARD = 20;
const DAILY_REWARD = 5;
const REFERRAL_REWARD = 10;

const TOOLS_DATA = {
  "spotify-verify": { name: "Spotify Premium", emoji: "🎵" },
  "youtube-verify": { name: "YouTube Premium", emoji: "▶️" },
  "one-verify": { name: "Gemini Advanced", emoji: "🤖" },
  "boltnew-verify": { name: "Bolt.new", emoji: "⚡" },
  "canva-teacher": { name: "Canva Education", emoji: "🎨" },
  "k12-verify": { name: "ChatGPT Plus", emoji: "🧠" },
  "veterans-verify": { name: "Military Verification", emoji: "🛡️" },
  "veterans-extension": { name: "Chrome Extension", emoji: "🌐" },
};

const PROGRAM_ID_MAP = {
  "67c8c14f5f17a83b745e3f82": "student",
  "68cc6a2e64f55220de204448": "teacher",
  "68d47554aa292d20b9bec8f7": "k12teacher",
};

const pendingSelections = new Map();

const BOT_SYSTEM_PROMPT = `You are the AI assistant for SheerID Verification Bot (@shs_ai_assistant_bot).

About this bot:
- This bot helps users verify their student/teacher/military status through SheerID to get premium service discounts
- Supported services: Spotify Premium, YouTube Premium, Gemini Advanced, Bolt.new, Canva Education, ChatGPT Plus
- The bot uses a token economy system

Token System:
- Join channel reward: ${JOIN_REWARD} tokens
- Daily bonus (/daily): ${DAILY_REWARD} tokens per day
- Referral reward: ${REFERRAL_REWARD} tokens per referral
- Verification cost: ${VERIFICATION_COST} tokens per attempt

Bot Commands:
- /start — Register and get started
- /verify {link} — Run a SheerID verification (costs ${VERIFICATION_COST} tokens)
- /daily — Claim daily token bonus
- /balance — Check token balance
- /referral — Get your referral link
- /admin — Admin commands (admin only)

How verification works:
1. User gets a verification link from a service (e.g., Spotify student discount page)
2. User sends /verify {link} to this bot
3. Bot auto-generates identity, creates documents, and submits to SheerID
4. If successful, user gets a reward code or redirect URL to claim the discount
5. If it fails, tokens are refunded

Channel: @aamoviesofficial (users must join to use the bot)

You should:
- Answer questions about the bot, its features, and how to use it
- Help users troubleshoot verification issues
- Be friendly, helpful, and concise
- If asked about something unrelated, you can still help but gently remind them about the bot's purpose
- Never reveal internal technical details about the verification engine or API
- Always respond in the same language the user writes in`;

async function apiCall(method, path, body) {
  const options = {
    method,
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${BOT_API_SECRET}`,
    },
  };
  if (body) options.body = JSON.stringify(body);

  try {
    const res = await fetch(`${REPLIT_SERVER}${path}`, options);
    const data = await res.json();
    if (!res.ok) return { ok: false, status: res.status, data };
    return { ok: true, status: res.status, data };
  } catch (err) {
    console.error(`[API] ${method} ${path} failed:`, err.message);
    return { ok: false, status: 0, data: null };
  }
}

async function getUser(telegramId) {
  const res = await apiCall("GET", `/api/bot/user/${telegramId}`);
  return res.ok ? res.data : null;
}

async function getUserByReferralCode(code) {
  const res = await apiCall("GET", `/api/bot/user/referral/${code}`);
  return res.ok ? res.data : null;
}

async function createUser(telegramId, username, firstName, referredBy) {
  const res = await apiCall("POST", "/api/bot/user", {
    telegramId, username, firstName, referredBy,
  });
  return res.ok ? res.data : null;
}

async function updateUser(telegramId, data) {
  const res = await apiCall("PATCH", `/api/bot/user/${telegramId}`, data);
  return res.ok ? res.data : null;
}

async function addTokens(telegramId, amount) {
  const res = await apiCall("POST", `/api/bot/user/${telegramId}/addtokens`, { amount });
  return res.ok ? res.data : null;
}

async function deductTokens(telegramId, amount) {
  const res = await apiCall("POST", `/api/bot/user/${telegramId}/deducttokens`, { amount });
  return res.ok ? res.data : null;
}

async function getAllUsers() {
  const res = await apiCall("GET", "/api/bot/users");
  return res.ok ? res.data : [];
}

function isAdmin(username) {
  if (!username) return false;
  return username.toLowerCase() === ADMIN_USERNAME;
}

function extractProgramIdFromUrl(url) {
  const match = url.match(/\/verify\/([a-f0-9]{24})\//i);
  if (match) return match[1];
  return null;
}

function detectToolId(url) {
  const linkLower = url.toLowerCase();

  if (linkLower.includes("offers.spotify.com") || linkLower.includes("spotify.com")) return "spotify-verify";
  if (linkLower.includes("youtube.com") || linkLower.includes("youtube.")) return "youtube-verify";
  if (linkLower.includes("one.google.com") || linkLower.includes("gemini")) return "one-verify";
  if (linkLower.includes("google.com/verify") || linkLower.includes("google.com/student")) return "one-verify";
  if (linkLower.includes("bolt.new") || linkLower.includes("bolt")) return "boltnew-verify";
  if (linkLower.includes("canva.com") || linkLower.includes("canva")) return "canva-teacher";
  if (linkLower.includes("chatgpt.com") || linkLower.includes("openai.com") || linkLower.includes("chatgpt") || linkLower.includes("openai")) return "k12-verify";

  const programId = extractProgramIdFromUrl(url);
  if (programId) {
    const verifyType = PROGRAM_ID_MAP[programId];
    if (verifyType === "teacher") return "boltnew-verify";
    if (verifyType === "k12teacher") return "k12-verify";
  }

  return null;
}

function parseVerificationId(url) {
  const match = url.match(/verificationId=([a-f0-9-]+)/i);
  if (match) return match[1].replace(/-/g, "");
  return null;
}

async function forwardToReplitServer(toolId, url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 540000);

  try {
    const response = await fetch(`${REPLIT_SERVER}/api/verifications/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ toolId, url, autoGenerate: true }),
      signal: controller.signal,
    });

    const data = await response.json();
    return { ok: response.ok, status: response.status, data };
  } finally {
    clearTimeout(timeout);
  }
}

async function askAI(userMessage, userContext) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 50000);

    const res = await fetch(`${REPLIT_SERVER}/api/bot/ai`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${BOT_TOKEN}`,
      },
      body: JSON.stringify({
        message: userMessage,
        systemPrompt: BOT_SYSTEM_PROMPT,
        userContext,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      console.error("[AI] Server returned", res.status);
      return null;
    }

    const data = await res.json();
    return data.reply || null;
  } catch (err) {
    console.error("[AI] Request failed:", err.message);
    return null;
  }
}

const bot = new TelegramBot(BOT_TOKEN, { polling: true });
console.log("[Telegram] Bot started with polling (persistent storage via Replit API)");
console.log(`[Config] Replit server: ${REPLIT_SERVER}`);

bot.onText(/\/start(.*)/, async (msg, match) => {
  try {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id.toString();
    const param = (match?.[1] || "").trim();

    let user = await getUser(telegramId);

    if (!user) {
      let referredByCode;
      if (param.startsWith("ref_")) {
        referredByCode = param.replace("ref_", "");
        const referrer = await getUserByReferralCode(referredByCode);
        if (!referrer || referrer.telegramId === telegramId) referredByCode = undefined;
      }
      user = await createUser(telegramId, msg.from?.username, msg.from?.first_name, referredByCode);
      if (!user) {
        await bot.sendMessage(chatId, "Failed to register. Please try again later.");
        return;
      }
    }

    if (user.hasJoinedChannel) {
      await bot.sendMessage(chatId,
        `Welcome back, ${user.firstName || "User"}!\n\n` +
        `Your balance: ${user.tokens} tokens\n\n` +
        `Use /verify {link} to run a verification (costs ${VERIFICATION_COST} tokens)\n` +
        `Use /daily to claim daily bonus\n` +
        `Use /balance to check your tokens\n` +
        `Use /referral to get your referral link`,
        { parse_mode: "HTML" }
      );
      return;
    }

    await bot.sendMessage(chatId,
      `Welcome to SheerID Verification Bot!\n\n` +
      `To get started, please join our channel first:\n` +
      `https://t.me/aamoviesofficial\n\n` +
      `After joining, click the button below to verify.`,
      {
        reply_markup: {
          inline_keyboard: [[{ text: "I'm Joined", callback_data: "verify_join" }]]
        }
      }
    );
  } catch (err) {
    console.error("[Telegram] /start error:", err.message);
  }
});

bot.on("callback_query", async (query) => {
  if (!query.message || !query.from) return;
  const chatId = query.message.chat.id;
  const telegramId = query.from.id.toString();

  try {
    if (query.data === "verify_join") {
      let user = await getUser(telegramId);
      if (!user) user = await createUser(telegramId, query.from.username, query.from.first_name);

      if (!user) {
        await bot.answerCallbackQuery(query.id, { text: "Failed to register. Try again." });
        return;
      }

      if (user.hasJoinedChannel) {
        await bot.answerCallbackQuery(query.id, { text: "You're already verified!" });
        return;
      }

      try {
        const member = await bot.getChatMember(CHANNEL_ID, parseInt(telegramId));
        const isMember = ["member", "administrator", "creator"].includes(member.status);

        if (isMember) {
          await updateUser(telegramId, { hasJoinedChannel: true });
          const updated = await addTokens(telegramId, JOIN_REWARD);

          if (user.referredBy) {
            const referrer = await getUserByReferralCode(user.referredBy);
            if (referrer) {
              await addTokens(referrer.telegramId, REFERRAL_REWARD);
              try { await bot.sendMessage(parseInt(referrer.telegramId), `Your referral joined! You earned ${REFERRAL_REWARD} tokens!`); } catch {}
            }
          }

          const balance = updated?.tokens || JOIN_REWARD;
          await bot.answerCallbackQuery(query.id, { text: `Welcome! You earned ${JOIN_REWARD} tokens!` });
          await bot.sendMessage(chatId,
            `Channel membership verified!\nYou earned ${JOIN_REWARD} tokens!\n\nYour balance: ${balance} tokens\n\n` +
            `Use /verify {link} to run a verification\n` +
            `Use /daily to claim daily bonus\n` +
            `Use /referral to get your referral link`
          );
        } else {
          await bot.answerCallbackQuery(query.id, { text: "You haven't joined the channel yet!", show_alert: true });
        }
      } catch (err) {
        await updateUser(telegramId, { hasJoinedChannel: true });
        const updated = await addTokens(telegramId, JOIN_REWARD);
        const balance = updated?.tokens || JOIN_REWARD;
        await bot.answerCallbackQuery(query.id, { text: `Welcome! You earned ${JOIN_REWARD} tokens!` });
        await bot.sendMessage(chatId, `Welcome! You earned ${JOIN_REWARD} tokens!\nYour balance: ${balance} tokens`);
      }
    } else if (query.data && query.data.startsWith("tool_")) {
      const parts = query.data.split("|");
      const toolId = parts[0].replace("tool_", "");
      const selectionKey = parts[1];
      const url = pendingSelections.get(selectionKey);
      pendingSelections.delete(selectionKey);

      if (!toolId || !url) {
        await bot.answerCallbackQuery(query.id, { text: "Selection expired. Please send /verify again.", show_alert: true });
        return;
      }

      const tool = TOOLS_DATA[toolId];
      await bot.answerCallbackQuery(query.id, { text: `Selected: ${tool?.name || toolId}` });

      try {
        await bot.editMessageText(
          `Selected: ${tool?.emoji || ""} ${tool?.name || toolId}\nStarting verification...`,
          { chat_id: chatId, message_id: query.message.message_id }
        );
      } catch {}

      await runVerificationFlow(chatId, telegramId, toolId, url);
    }
  } catch (err) {
    console.error("[Telegram] callback error:", err.message);
    try { await bot.answerCallbackQuery(query.id, { text: "An error occurred." }); } catch {}
  }
});

bot.onText(/\/daily/, async (msg) => {
  const chatId = msg.chat.id;
  const telegramId = msg.from.id.toString();
  const user = await getUser(telegramId);

  if (!user) { await bot.sendMessage(chatId, "Please use /start first to register."); return; }
  if (!user.hasJoinedChannel) { await bot.sendMessage(chatId, "Please join the channel and verify first using /start."); return; }

  const now = Date.now();
  const oneDay = 24 * 60 * 60 * 1000;

  if (user.lastDaily) {
    const lastDailyTime = new Date(user.lastDaily).getTime();
    if ((now - lastDailyTime) < oneDay) {
      const timeLeft = oneDay - (now - lastDailyTime);
      const hours = Math.floor(timeLeft / (60 * 60 * 1000));
      const minutes = Math.floor((timeLeft % (60 * 60 * 1000)) / (60 * 1000));
      await bot.sendMessage(chatId, `You've already claimed your daily bonus.\nCome back in ${hours}h ${minutes}m.\n\nYour balance: ${user.tokens} tokens`);
      return;
    }
  }

  await updateUser(telegramId, { lastDaily: new Date() });
  const updated = await addTokens(telegramId, DAILY_REWARD);
  const balance = updated?.tokens || user.tokens + DAILY_REWARD;
  await bot.sendMessage(chatId, `Daily bonus claimed! +${DAILY_REWARD} tokens\n\nYour balance: ${balance} tokens`);
});

bot.onText(/\/balance/, async (msg) => {
  const chatId = msg.chat.id;
  const user = await getUser(msg.from.id.toString());
  if (!user) { await bot.sendMessage(chatId, "Please use /start first to register."); return; }
  await bot.sendMessage(chatId,
    `Your token balance: ${user.tokens} tokens\n\n` +
    `Earn tokens:\n- /daily — ${DAILY_REWARD} tokens (once per day)\n- /referral — ${REFERRAL_REWARD} tokens per referral\n\n` +
    `Spend tokens:\n- /verify {link} — ${VERIFICATION_COST} tokens per verification`
  );
});

bot.onText(/\/referral/, async (msg) => {
  const chatId = msg.chat.id;
  const user = await getUser(msg.from.id.toString());
  if (!user) { await bot.sendMessage(chatId, "Please use /start first to register."); return; }
  const botInfo = await bot.getMe();
  const referralLink = `https://t.me/${botInfo.username}?start=ref_${user.referralCode}`;
  await bot.sendMessage(chatId, `Your referral link:\n${referralLink}\n\nShare this link with friends. You'll earn ${REFERRAL_REWARD} tokens for each person who joins!`);
});

async function runVerificationFlow(chatId, telegramId, toolId, link) {
  const user = await getUser(telegramId);
  if (!user) { await bot.sendMessage(chatId, "Please use /start first to register."); return; }

  const deducted = await deductTokens(telegramId, VERIFICATION_COST);
  if (!deducted) { await bot.sendMessage(chatId, `Insufficient tokens. You need ${VERIFICATION_COST} tokens but have ${user.tokens}.\n\nEarn tokens with /daily or /referral.`); return; }

  const tool = TOOLS_DATA[toolId];
  const toolName = tool ? `${tool.emoji} ${tool.name}` : toolId;

  const statusMsg = await bot.sendMessage(chatId,
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `${toolName}\n` +
    `━━━━━━━━━━━━━━━━━━━━\n\n` +
    `Status: ⏳ Processing...\n` +
    `Tokens deducted: ${VERIFICATION_COST}\n\n` +
    `Forwarding to verification server.\n` +
    `This may take up to 5 minutes.\n` +
    `Please wait...`
  );

  let tokensRefunded = false;

  async function refundTokens() {
    if (!tokensRefunded) {
      await addTokens(telegramId, VERIFICATION_COST);
      tokensRefunded = true;
    }
  }

  async function getBalance() {
    const u = await getUser(telegramId);
    return u?.tokens || 0;
  }

  try {
    const serverResponse = await forwardToReplitServer(toolId, link);

    if (!serverResponse.ok) {
      await refundTokens();
      const balance = await getBalance();
      const errMsg = serverResponse.data?.message || `Server error (HTTP ${serverResponse.status})`;

      try {
        await bot.editMessageText(
          `━━━━━━━━━━━━━━━━━━━━\n` +
          `${toolName}\n` +
          `━━━━━━━━━━━━━━━━━━━━\n\n` +
          `Status: ❌ FAILED\n\n` +
          `Reason: ${errMsg}\n\n` +
          `Your ${VERIFICATION_COST} tokens have been refunded.\n` +
          `Balance: ${balance} tokens`,
          { chat_id: chatId, message_id: statusMsg.message_id }
        );
      } catch {
        await bot.sendMessage(chatId,
          `❌ FAILED — ${toolName}\n\nReason: ${errMsg}\n\nYour ${VERIFICATION_COST} tokens have been refunded.\nBalance: ${balance} tokens`
        );
      }
      return;
    }

    const result = serverResponse.data;
    const verification = result.verification;
    const finalStatus = verification?.status || "failed";

    if (finalStatus === "success") {
      const balance = await getBalance();
      let successText =
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `${toolName}\n` +
        `━━━━━━━━━━━━━━━━━━━━\n\n` +
        `Status: ✅ SUCCESS\n\n` +
        `Name: ${verification.name || "N/A"}\n` +
        `Email: ${verification.email || "N/A"}\n` +
        `University: ${verification.university || "N/A"}\n` +
        `Balance: ${balance} tokens`;

      if (result.rewardCode) {
        successText += `\n\nReward Code: ${result.rewardCode}`;
      }
      if (result.redirectUrl) {
        successText += `\n\nClaim your offer:\n${result.redirectUrl}`;
      }

      try {
        await bot.editMessageText(successText, { chat_id: chatId, message_id: statusMsg.message_id });
      } catch {
        await bot.sendMessage(chatId, successText);
      }
    } else {
      await refundTokens();
      const balance = await getBalance();

      let rawError = verification?.errorMessage || result.message || "Unknown error";
      let friendlyReason = rawError;

      if (rawError.includes("timed out") || rawError.includes("timeout") || rawError.includes("TimeoutError")) {
        friendlyReason = "The verification server took too long to respond. This usually means SheerID is under heavy load. Please try again in a few minutes.";
      } else if (rawError.includes("expiredVerification")) {
        friendlyReason = "This verification link has expired. Please generate a new verification link from the service website and try again.";
      } else if (rawError.includes("noVerification")) {
        friendlyReason = "The verification ID in this link is invalid or does not exist. Please double-check the link.";
      } else if (rawError.includes("maxReviewsExceeded")) {
        friendlyReason = "Maximum document review attempts exceeded for this verification. Please start a new verification.";
      } else if (rawError.includes("HTTP 4")) {
        const httpMatch = rawError.match(/HTTP (\d+)/);
        friendlyReason = `SheerID rejected the request (Error ${httpMatch ? httpMatch[1] : "4xx"}). The verification link may be expired or invalid.`;
      }

      try {
        await bot.editMessageText(
          `━━━━━━━━━━━━━━━━━━━━\n` +
          `${toolName}\n` +
          `━━━━━━━━━━━━━━━━━━━━\n\n` +
          `Status: ❌ FAILED\n\n` +
          `Reason: ${friendlyReason}\n\n` +
          `Your ${VERIFICATION_COST} tokens have been refunded.\n` +
          `Balance: ${balance} tokens`,
          { chat_id: chatId, message_id: statusMsg.message_id }
        );
      } catch {
        await bot.sendMessage(chatId,
          `❌ FAILED — ${toolName}\n\nReason: ${friendlyReason}\n\nYour ${VERIFICATION_COST} tokens have been refunded.\nBalance: ${balance} tokens`
        );
      }
    }
  } catch (err) {
    await refundTokens();
    const balance = await getBalance();

    let friendlyError = err.message || "Unknown error";
    if (err.name === "AbortError" || friendlyError.includes("abort")) {
      friendlyError = "The request to the verification server timed out. The server may be busy. Please try again in a few minutes.";
    } else if (friendlyError.includes("fetch") || friendlyError.includes("ECONNREFUSED") || friendlyError.includes("network")) {
      friendlyError = "Could not connect to the verification server. It may be temporarily unavailable. Please try again shortly.";
    }

    try {
      await bot.editMessageText(
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `${toolName}\n` +
        `━━━━━━━━━━━━━━━━━━━━\n\n` +
        `Status: ⚠️ ERROR\n\n` +
        `${friendlyError}\n\n` +
        `Your ${VERIFICATION_COST} tokens have been refunded.\n` +
        `Balance: ${balance} tokens`,
        { chat_id: chatId, message_id: statusMsg.message_id }
      );
    } catch {
      await bot.sendMessage(chatId,
        `⚠️ ERROR — ${toolName}\n\n${friendlyError}\n\nYour ${VERIFICATION_COST} tokens have been refunded.\nBalance: ${balance} tokens`
      );
    }
  }
}

bot.onText(/\/verify(?:\s+(.+))?/, async (msg, match) => {
  const chatId = msg.chat.id;
  const telegramId = msg.from.id.toString();
  const user = await getUser(telegramId);

  if (!user) { await bot.sendMessage(chatId, "Please use /start first to register."); return; }
  if (!user.hasJoinedChannel) { await bot.sendMessage(chatId, "Please join the channel and verify first using /start."); return; }

  const link = match?.[1]?.trim();
  if (!link) {
    await bot.sendMessage(chatId,
      "Usage: /verify {link}\n\n" +
      "Example:\n/verify https://offers.spotify.com/verify?verificationId=abc123\n\n" +
      "Supported services:\n" +
      "🎵 Spotify Premium\n" +
      "▶️ YouTube Premium\n" +
      "🤖 Gemini Advanced\n" +
      "⚡ Bolt.new\n" +
      "🎨 Canva Education\n" +
      "🧠 ChatGPT Plus"
    );
    return;
  }

  if (user.tokens < VERIFICATION_COST) {
    await bot.sendMessage(chatId, `Insufficient tokens. You need ${VERIFICATION_COST} tokens but have ${user.tokens}.\n\nEarn tokens with /daily or /referral.`);
    return;
  }

  const verificationId = parseVerificationId(link);
  if (!verificationId) { await bot.sendMessage(chatId, "Invalid link. URL must contain a verificationId parameter."); return; }

  const detectedToolId = detectToolId(link);

  if (!detectedToolId) {
    const selKey = crypto.randomBytes(4).toString("hex");
    pendingSelections.set(selKey, link);
    setTimeout(() => pendingSelections.delete(selKey), 300000);

    const programId = extractProgramIdFromUrl(link);
    const verifyType = programId ? PROGRAM_ID_MAP[programId] : null;

    let buttons;
    let promptText;

    if (verifyType === "student") {
      buttons = [
        [{ text: "🎵 Spotify Premium", callback_data: `tool_spotify-verify|${selKey}` }],
        [{ text: "▶️ YouTube Premium", callback_data: `tool_youtube-verify|${selKey}` }],
        [{ text: "🤖 Gemini Advanced", callback_data: `tool_one-verify|${selKey}` }],
      ];
      promptText = "This is a student verification link.\nWhich service is this verification for?";
    } else if (verifyType === "teacher") {
      buttons = [
        [
          { text: "⚡ Bolt.new", callback_data: `tool_boltnew-verify|${selKey}` },
          { text: "🎨 Canva Education", callback_data: `tool_canva-teacher|${selKey}` },
        ],
      ];
      promptText = "This is a teacher verification link.\nWhich service is this verification for?";
    } else {
      buttons = [
        [
          { text: "🎵 Spotify", callback_data: `tool_spotify-verify|${selKey}` },
          { text: "▶️ YouTube", callback_data: `tool_youtube-verify|${selKey}` },
          { text: "🤖 Gemini", callback_data: `tool_one-verify|${selKey}` },
        ],
        [
          { text: "⚡ Bolt.new", callback_data: `tool_boltnew-verify|${selKey}` },
          { text: "🎨 Canva", callback_data: `tool_canva-teacher|${selKey}` },
          { text: "🧠 ChatGPT", callback_data: `tool_k12-verify|${selKey}` },
        ],
      ];
      promptText = "Could not auto-detect the service from this link.\nPlease select the correct tool:";
    }

    await bot.sendMessage(chatId, promptText,
      { reply_markup: { inline_keyboard: buttons } }
    );
    return;
  }

  const tool = TOOLS_DATA[detectedToolId];
  await bot.sendMessage(chatId,
    `Auto-detected: ${tool.emoji} ${tool.name}\nStarting verification...`
  );

  await runVerificationFlow(chatId, telegramId, detectedToolId, link);
});

bot.onText(/\/admin(?:\s+(.+))?/, async (msg, match) => {
  const chatId = msg.chat.id;
  if (!isAdmin(msg.from?.username)) { await bot.sendMessage(chatId, "You don't have admin permissions."); return; }

  const args = (match?.[1] || "").trim();
  if (!args) {
    await bot.sendMessage(chatId,
      `Admin Commands:\n\n` +
      `/admin addtokens {telegram_id} {amount}\n` +
      `/admin removetokens {telegram_id} {amount}\n` +
      `/admin setbalance {telegram_id} {amount}\n` +
      `/admin userinfo {telegram_id}\n` +
      `/admin users — List all users\n` +
      `/admin stats — System stats\n` +
      `/admin giveaway {amount} — Give tokens to all users`
    );
    return;
  }

  const parts = args.split(/\s+/);
  const subCmd = parts[0].toLowerCase();

  if (subCmd === "addtokens" && parts.length >= 3) {
    const targetId = parts[1];
    const amount = parseInt(parts[2]);
    if (isNaN(amount) || amount <= 0) { await bot.sendMessage(chatId, "Invalid amount."); return; }
    const updated = await addTokens(targetId, amount);
    if (updated) {
      await bot.sendMessage(chatId, `Added ${amount} tokens to user ${targetId}. New balance: ${updated.tokens}`);
      try { await bot.sendMessage(parseInt(targetId), `Admin added ${amount} tokens to your account. New balance: ${updated.tokens}`); } catch {}
    } else {
      await bot.sendMessage(chatId, `User ${targetId} not found.`);
    }
  } else if (subCmd === "removetokens" && parts.length >= 3) {
    const targetId = parts[1];
    const amount = parseInt(parts[2]);
    if (isNaN(amount) || amount <= 0) { await bot.sendMessage(chatId, "Invalid amount."); return; }
    const user = await getUser(targetId);
    if (!user) { await bot.sendMessage(chatId, `User ${targetId} not found.`); return; }
    const newBalance = Math.max(0, user.tokens - amount);
    await updateUser(targetId, { tokens: newBalance });
    await bot.sendMessage(chatId, `Removed ${amount} tokens from user ${targetId}. New balance: ${newBalance}`);
  } else if (subCmd === "setbalance" && parts.length >= 3) {
    const targetId = parts[1];
    const amount = parseInt(parts[2]);
    if (isNaN(amount) || amount < 0) { await bot.sendMessage(chatId, "Invalid amount."); return; }
    const user = await getUser(targetId);
    if (!user) { await bot.sendMessage(chatId, `User ${targetId} not found.`); return; }
    await updateUser(targetId, { tokens: amount });
    await bot.sendMessage(chatId, `Set balance for user ${targetId} to ${amount} tokens.`);
  } else if (subCmd === "userinfo" && parts.length >= 2) {
    const targetId = parts[1];
    const user = await getUser(targetId);
    if (!user) { await bot.sendMessage(chatId, `User ${targetId} not found.`); return; }
    await bot.sendMessage(chatId,
      `User Info:\nID: ${user.telegramId}\nUsername: ${user.username || "N/A"}\nName: ${user.firstName || "N/A"}\n` +
      `Tokens: ${user.tokens}\nReferral Code: ${user.referralCode}\nReferred By: ${user.referredBy || "None"}\n` +
      `Channel Joined: ${user.hasJoinedChannel ? "Yes" : "No"}\nLast Daily: ${user.lastDaily ? new Date(user.lastDaily).toISOString() : "Never"}\n` +
      `Joined: ${new Date(user.createdAt).toISOString()}`
    );
  } else if (subCmd === "users") {
    const allUsers = await getAllUsers();
    if (allUsers.length === 0) { await bot.sendMessage(chatId, "No users registered yet."); return; }
    const totalTokens = allUsers.reduce((sum, u) => sum + u.tokens, 0);
    let text = `Total Users: ${allUsers.length}\nTotal Tokens in circulation: ${totalTokens}\n\n`;
    const displayUsers = allUsers.slice(0, 20);
    for (const u of displayUsers) {
      text += `${u.telegramId} | @${u.username || "N/A"} | ${u.tokens} tokens\n`;
    }
    if (allUsers.length > 20) text += `\n... and ${allUsers.length - 20} more users`;
    await bot.sendMessage(chatId, text);
  } else if (subCmd === "stats") {
    const allUsers = await getAllUsers();
    await bot.sendMessage(chatId,
      `System Stats:\n\nServer: ${REPLIT_SERVER}\nTotal Users: ${allUsers.length}\n` +
      `Storage: PostgreSQL (persistent)\nAI Model: DeepSeek-R1`
    );
  } else if (subCmd === "giveaway" && parts.length >= 2) {
    const amount = parseInt(parts[1]);
    if (isNaN(amount) || amount <= 0) { await bot.sendMessage(chatId, "Invalid amount."); return; }
    const allUsers = await getAllUsers();
    let count = 0;
    for (const u of allUsers) {
      await addTokens(u.telegramId, amount);
      count++;
      try { await bot.sendMessage(parseInt(u.telegramId), `Giveaway! You received ${amount} tokens from admin!`); } catch {}
    }
    await bot.sendMessage(chatId, `Giveaway complete! ${amount} tokens sent to ${count} users.`);
  } else {
    await bot.sendMessage(chatId, "Unknown admin command. Use /admin for help.");
  }
});

bot.on("message", async (msg) => {
  if (!msg.text || msg.text.startsWith("/")) return;
  if (msg.chat.type !== "private") return;

  const chatId = msg.chat.id;
  const telegramId = msg.from.id.toString();

  try {
    const user = await getUser(telegramId);
    const userContext = user
      ? `Registered user: ${user.firstName || "Unknown"}, tokens: ${user.tokens}, joined channel: ${user.hasJoinedChannel}`
      : "Unregistered user";

    await bot.sendChatAction(chatId, "typing");

    const reply = await askAI(msg.text, userContext);

    if (reply) {
      const maxLen = 4000;
      if (reply.length > maxLen) {
        const parts = reply.match(/.{1,4000}/gs) || [reply];
        for (const part of parts) {
          await bot.sendMessage(chatId, part);
        }
      } else {
        await bot.sendMessage(chatId, reply);
      }
    } else {
      await bot.sendMessage(chatId,
        "I'm the SheerID Verification Bot assistant. I can help you with:\n\n" +
        "• How to use the bot\n" +
        "• Token system questions\n" +
        "• Verification help\n\n" +
        "Try asking me a question, or use /start to get started!"
      );
    }
  } catch (err) {
    console.error("[AI] Message handler error:", err.message);
  }
});

bot.on("polling_error", (error) => { console.error("[Telegram] Polling error:", error.message); });
bot.on("error", (error) => { console.error("[Telegram] Bot error:", error.message); });

process.on("unhandledRejection", (reason) => {
  if (reason?.message?.includes("telegram") || reason?.message?.includes("ETELEGRAM")) {
    console.error("[Telegram] Unhandled rejection:", reason.message);
  }
});

console.log("[Bot] Standalone relay bot running with PERSISTENT storage (PostgreSQL via Replit API)");
console.log("[Bot] AI: DeepSeek-R1 integrated for non-command messages");
console.log("[Bot] All verifications forwarded to " + REPLIT_SERVER);
