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
const VERIFICATION_COST = 50;
const JOIN_REWARD = 20;
const DAILY_REWARD = 5;
const REFERRAL_REWARD = 10;

const TOOLS_DATA = {
  "spotify-verify": { name: "Spotify Premium" },
  "youtube-verify": { name: "YouTube Premium" },
  "one-verify": { name: "Gemini Advanced" },
  "boltnew-verify": { name: "Bolt.new" },
  "canva-teacher": { name: "Canva Education" },
  "k12-verify": { name: "ChatGPT Plus" },
  "veterans-verify": { name: "Military Verification" },
  "veterans-extension": { name: "Chrome Extension" },
};

const users = new Map();
const statsData = { totalAttempts: 0, successCount: 0, failedCount: 0 };

function generateReferralCode() {
  return crypto.randomBytes(4).toString("hex");
}

function getUser(telegramId) {
  return users.get(telegramId) || null;
}

function getUserByReferralCode(code) {
  for (const u of users.values()) {
    if (u.referralCode === code) return u;
  }
  return null;
}

function createUser(telegramId, username, firstName, referredBy) {
  const user = {
    telegramId,
    username: username || null,
    firstName: firstName || null,
    tokens: 0,
    referralCode: generateReferralCode(),
    referredBy: referredBy || null,
    hasJoinedChannel: false,
    lastDaily: null,
    createdAt: new Date(),
  };
  users.set(telegramId, user);
  return user;
}

function addTokens(telegramId, amount) {
  const user = users.get(telegramId);
  if (!user) return null;
  user.tokens += amount;
  return user;
}

function deductTokens(telegramId, amount) {
  const user = users.get(telegramId);
  if (!user || user.tokens < amount) return null;
  user.tokens -= amount;
  return user;
}

function isAdmin(username) {
  if (!username) return false;
  return username.toLowerCase() === ADMIN_USERNAME;
}

function detectToolId(url) {
  const linkLower = url.toLowerCase();
  if (linkLower.includes("spotify")) return "spotify-verify";
  if (linkLower.includes("youtube")) return "youtube-verify";
  if (linkLower.includes("google") || linkLower.includes("one.google")) return "one-verify";
  if (linkLower.includes("bolt")) return "boltnew-verify";
  if (linkLower.includes("canva")) return "canva-teacher";
  if (linkLower.includes("chatgpt") || linkLower.includes("openai")) return "k12-verify";
  return "spotify-verify";
}

function parseVerificationId(url) {
  const match = url.match(/verificationId=([a-f0-9-]+)/i);
  if (match) return match[1].replace(/-/g, "");
  return null;
}

async function forwardToReplitServer(toolId, url) {
  const response = await fetch(`${REPLIT_SERVER}/api/verifications/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ toolId, url, autoGenerate: true }),
    signal: AbortSignal.timeout(600000),
  });

  const data = await response.json();
  return { ok: response.ok, status: response.status, data };
}

const bot = new TelegramBot(BOT_TOKEN, { polling: true });
console.log("[Telegram] Bot started with polling");
console.log(`[Config] Replit server: ${REPLIT_SERVER}`);

bot.onText(/\/start(.*)/, async (msg, match) => {
  try {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id.toString();
    const param = (match?.[1] || "").trim();

    let user = getUser(telegramId);

    if (!user) {
      let referredByCode;
      if (param.startsWith("ref_")) {
        referredByCode = param.replace("ref_", "");
        const referrer = getUserByReferralCode(referredByCode);
        if (!referrer || referrer.telegramId === telegramId) referredByCode = undefined;
      }
      user = createUser(telegramId, msg.from?.username, msg.from?.first_name, referredByCode);
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
      let user = getUser(telegramId);
      if (!user) user = createUser(telegramId, query.from.username, query.from.first_name);

      if (user.hasJoinedChannel) {
        await bot.answerCallbackQuery(query.id, { text: "You're already verified!" });
        return;
      }

      try {
        const member = await bot.getChatMember(CHANNEL_ID, parseInt(telegramId));
        const isMember = ["member", "administrator", "creator"].includes(member.status);

        if (isMember) {
          user.hasJoinedChannel = true;
          addTokens(telegramId, JOIN_REWARD);

          if (user.referredBy) {
            const referrer = getUserByReferralCode(user.referredBy);
            if (referrer) {
              addTokens(referrer.telegramId, REFERRAL_REWARD);
              try { await bot.sendMessage(parseInt(referrer.telegramId), `Your referral joined! You earned ${REFERRAL_REWARD} tokens!`); } catch {}
            }
          }

          await bot.answerCallbackQuery(query.id, { text: `Welcome! You earned ${JOIN_REWARD} tokens!` });
          await bot.sendMessage(chatId,
            `Channel membership verified!\nYou earned ${JOIN_REWARD} tokens!\n\nYour balance: ${user.tokens} tokens\n\n` +
            `Use /verify {link} to run a verification\n` +
            `Use /daily to claim daily bonus\n` +
            `Use /referral to get your referral link`
          );
        } else {
          await bot.answerCallbackQuery(query.id, { text: "You haven't joined the channel yet!", show_alert: true });
        }
      } catch (err) {
        user.hasJoinedChannel = true;
        addTokens(telegramId, JOIN_REWARD);
        await bot.answerCallbackQuery(query.id, { text: `Welcome! You earned ${JOIN_REWARD} tokens!` });
        await bot.sendMessage(chatId, `Welcome! You earned ${JOIN_REWARD} tokens!\nYour balance: ${user.tokens} tokens`);
      }
    }
  } catch (err) {
    console.error("[Telegram] callback error:", err.message);
    try { await bot.answerCallbackQuery(query.id, { text: "An error occurred." }); } catch {}
  }
});

bot.onText(/\/daily/, async (msg) => {
  const chatId = msg.chat.id;
  const telegramId = msg.from.id.toString();
  const user = getUser(telegramId);

  if (!user) { await bot.sendMessage(chatId, "Please use /start first to register."); return; }
  if (!user.hasJoinedChannel) { await bot.sendMessage(chatId, "Please join the channel and verify first using /start."); return; }

  const now = Date.now();
  const oneDay = 24 * 60 * 60 * 1000;

  if (user.lastDaily && (now - user.lastDaily) < oneDay) {
    const timeLeft = oneDay - (now - user.lastDaily);
    const hours = Math.floor(timeLeft / (60 * 60 * 1000));
    const minutes = Math.floor((timeLeft % (60 * 60 * 1000)) / (60 * 1000));
    await bot.sendMessage(chatId, `You've already claimed your daily bonus.\nCome back in ${hours}h ${minutes}m.\n\nYour balance: ${user.tokens} tokens`);
    return;
  }

  user.lastDaily = now;
  addTokens(telegramId, DAILY_REWARD);
  await bot.sendMessage(chatId, `Daily bonus claimed! +${DAILY_REWARD} tokens\n\nYour balance: ${user.tokens} tokens`);
});

bot.onText(/\/balance/, async (msg) => {
  const chatId = msg.chat.id;
  const user = getUser(msg.from.id.toString());
  if (!user) { await bot.sendMessage(chatId, "Please use /start first to register."); return; }
  await bot.sendMessage(chatId,
    `Your token balance: ${user.tokens} tokens\n\n` +
    `Earn tokens:\n- /daily — ${DAILY_REWARD} tokens (once per day)\n- /referral — ${REFERRAL_REWARD} tokens per referral\n\n` +
    `Spend tokens:\n- /verify {link} — ${VERIFICATION_COST} tokens per verification`
  );
});

bot.onText(/\/referral/, async (msg) => {
  const chatId = msg.chat.id;
  const user = getUser(msg.from.id.toString());
  if (!user) { await bot.sendMessage(chatId, "Please use /start first to register."); return; }
  const botInfo = await bot.getMe();
  const referralLink = `https://t.me/${botInfo.username}?start=ref_${user.referralCode}`;
  await bot.sendMessage(chatId, `Your referral link:\n${referralLink}\n\nShare this link with friends. You'll earn ${REFERRAL_REWARD} tokens for each person who joins!`);
});

bot.onText(/\/verify(?:\s+(.+))?/, async (msg, match) => {
  const chatId = msg.chat.id;
  const telegramId = msg.from.id.toString();
  const user = getUser(telegramId);

  if (!user) { await bot.sendMessage(chatId, "Please use /start first to register."); return; }
  if (!user.hasJoinedChannel) { await bot.sendMessage(chatId, "Please join the channel and verify first using /start."); return; }

  const link = match?.[1]?.trim();
  if (!link) { await bot.sendMessage(chatId, "Usage: /verify {link}\n\nExample: /verify https://offers.spotify.com/verify?verificationId=abc123"); return; }

  if (user.tokens < VERIFICATION_COST) {
    await bot.sendMessage(chatId, `Insufficient tokens. You need ${VERIFICATION_COST} tokens but have ${user.tokens}.\n\nEarn tokens with /daily or /referral.`);
    return;
  }

  const verificationId = parseVerificationId(link);
  if (!verificationId) { await bot.sendMessage(chatId, "Invalid link. URL must contain a verificationId parameter."); return; }

  const detectedToolId = detectToolId(link);
  const tool = TOOLS_DATA[detectedToolId];
  if (!tool) { await bot.sendMessage(chatId, "This verification tool is currently unavailable."); return; }

  const deducted = deductTokens(telegramId, VERIFICATION_COST);
  if (!deducted) { await bot.sendMessage(chatId, "Failed to deduct tokens. Please try again."); return; }

  const statusMsg = await bot.sendMessage(chatId,
    `Verification started for ${tool.name}...\n` +
    `Tokens deducted: ${VERIFICATION_COST}\n` +
    `Forwarding to server... Please wait, this may take several minutes.`
  );

  let tokensRefunded = false;
  try {
    const serverResponse = await forwardToReplitServer(detectedToolId, link);

    statsData.totalAttempts++;

    if (!serverResponse.ok) {
      statsData.failedCount++;
      if (!tokensRefunded) { addTokens(telegramId, VERIFICATION_COST); tokensRefunded = true; }
      const errMsg = serverResponse.data?.message || `Server error (HTTP ${serverResponse.status})`;
      await bot.sendMessage(chatId,
        `Verification failed. Your ${VERIFICATION_COST} tokens have been refunded.\n\n` +
        `Reason: ${errMsg}\n\nYour balance: ${user.tokens} tokens`
      );
      return;
    }

    const result = serverResponse.data;
    const verification = result.verification;
    const finalStatus = verification?.status || "failed";

    if (finalStatus === "success") {
      statsData.successCount++;
      let successText =
        `Verification successful!\n\n` +
        `Tool: ${tool.name}\n` +
        `Name: ${verification.name || "N/A"}\n` +
        `Email: ${verification.email || "N/A"}\n` +
        `University: ${verification.university || "N/A"}\n` +
        `Balance: ${user.tokens} tokens`;
      if (result.redirectUrl) successText += `\n\nClaim your offer:\n${result.redirectUrl}`;
      if (result.rewardCode) successText += `\n\nReward code: ${result.rewardCode}`;
      await bot.sendMessage(chatId, successText);
    } else {
      statsData.failedCount++;
      if (!tokensRefunded) { addTokens(telegramId, VERIFICATION_COST); tokensRefunded = true; }
      const errorMsg = verification?.errorMessage || result.message || "Unknown error";
      await bot.sendMessage(chatId,
        `Verification failed. Your ${VERIFICATION_COST} tokens have been refunded.\n\n` +
        `Reason: ${errorMsg}\n\nYour balance: ${user.tokens} tokens`
      );
    }
  } catch (err) {
    statsData.totalAttempts++;
    statsData.failedCount++;
    if (!tokensRefunded) { addTokens(telegramId, VERIFICATION_COST); tokensRefunded = true; }
    await bot.sendMessage(chatId,
      `An error occurred during verification. Your ${VERIFICATION_COST} tokens have been refunded.\n\n` +
      `Error: ${err.message || "Unknown error"}\n\nYour balance: ${user.tokens} tokens`
    );
  }
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
    const updated = addTokens(targetId, amount);
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
    const user = getUser(targetId);
    if (!user) { await bot.sendMessage(chatId, `User ${targetId} not found.`); return; }
    user.tokens = Math.max(0, user.tokens - amount);
    await bot.sendMessage(chatId, `Removed ${amount} tokens from user ${targetId}. New balance: ${user.tokens}`);
  } else if (subCmd === "setbalance" && parts.length >= 3) {
    const targetId = parts[1];
    const amount = parseInt(parts[2]);
    if (isNaN(amount) || amount < 0) { await bot.sendMessage(chatId, "Invalid amount."); return; }
    const user = getUser(targetId);
    if (!user) { await bot.sendMessage(chatId, `User ${targetId} not found.`); return; }
    user.tokens = amount;
    await bot.sendMessage(chatId, `Set balance for user ${targetId} to ${amount} tokens.`);
  } else if (subCmd === "userinfo" && parts.length >= 2) {
    const targetId = parts[1];
    const user = getUser(targetId);
    if (!user) { await bot.sendMessage(chatId, `User ${targetId} not found.`); return; }
    await bot.sendMessage(chatId,
      `User Info:\nID: ${user.telegramId}\nUsername: ${user.username || "N/A"}\nName: ${user.firstName || "N/A"}\n` +
      `Tokens: ${user.tokens}\nReferral Code: ${user.referralCode}\nReferred By: ${user.referredBy || "None"}\n` +
      `Channel Joined: ${user.hasJoinedChannel ? "Yes" : "No"}\nLast Daily: ${user.lastDaily ? new Date(user.lastDaily).toISOString() : "Never"}\n` +
      `Joined: ${new Date(user.createdAt).toISOString()}`
    );
  } else if (subCmd === "users") {
    const allUsers = Array.from(users.values());
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
    const allUsers = Array.from(users.values());
    await bot.sendMessage(chatId,
      `System Stats:\n\nServer: ${REPLIT_SERVER}\nTotal Users: ${allUsers.length}\nTotal Verifications: ${statsData.totalAttempts}\n` +
      `Successful: ${statsData.successCount}\nFailed: ${statsData.failedCount}\n` +
      `Success Rate: ${statsData.totalAttempts > 0 ? Math.round((statsData.successCount / statsData.totalAttempts) * 100) : 0}%`
    );
  } else if (subCmd === "giveaway" && parts.length >= 2) {
    const amount = parseInt(parts[1]);
    if (isNaN(amount) || amount <= 0) { await bot.sendMessage(chatId, "Invalid amount."); return; }
    const allUsers = Array.from(users.values());
    let count = 0;
    for (const u of allUsers) {
      addTokens(u.telegramId, amount);
      count++;
      try { await bot.sendMessage(parseInt(u.telegramId), `Giveaway! You received ${amount} tokens from admin!`); } catch {}
    }
    await bot.sendMessage(chatId, `Giveaway complete! ${amount} tokens sent to ${count} users.`);
  } else {
    await bot.sendMessage(chatId, "Unknown admin command. Use /admin for help.");
  }
});

bot.on("polling_error", (error) => { console.error("[Telegram] Polling error:", error.message); });
bot.on("error", (error) => { console.error("[Telegram] Bot error:", error.message); });

process.on("unhandledRejection", (reason) => {
  if (reason?.message?.includes("telegram") || reason?.message?.includes("ETELEGRAM")) {
    console.error("[Telegram] Unhandled rejection:", reason.message);
  }
});

console.log("[Bot] Standalone relay bot is running. All verifications forwarded to " + REPLIT_SERVER);
