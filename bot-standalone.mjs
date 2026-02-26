import TelegramBot from "node-telegram-bot-api";
import { execSync } from "child_process";
import * as fs from "fs";
import crypto from "crypto";

const BOT_TOKEN = process.env.BOT_TOKEN;
if (!BOT_TOKEN) {
  console.error("[FATAL] BOT_TOKEN environment variable is not set");
  process.exit(1);
}

const ADMIN_USERNAME = (process.env.TELEGRAM_ADMIN_USERNAME || "Aamoviesadmin").replace("@", "").toLowerCase();
const CHANNEL_ID = process.env.TELEGRAM_CHANNEL_ID || "@aamoviesofficial";
const VERIFICATION_COST = 50;
const JOIN_REWARD = 20;
const DAILY_REWARD = 5;
const REFERRAL_REWARD = 10;

const SHEERID_BASE_URL = "https://services.sheerid.com";
const MY_SHEERID_URL = "https://my.sheerid.com";

const TOOL_CONFIGS = {
  "spotify-verify": { programId: "67c8c14f5f17a83b745e3f82", verifyType: "student", collectStep: "collectStudentPersonalInfo" },
  "youtube-verify": { programId: "67c8c14f5f17a83b745e3f82", verifyType: "student", collectStep: "collectStudentPersonalInfo" },
  "one-verify": { programId: "67c8c14f5f17a83b745e3f82", verifyType: "student", collectStep: "collectStudentPersonalInfo" },
  "boltnew-verify": { programId: "68cc6a2e64f55220de204448", verifyType: "teacher", collectStep: "collectTeacherPersonalInfo" },
  "canva-teacher": { programId: "68cc6a2e64f55220de204448", verifyType: "teacher", collectStep: "collectTeacherPersonalInfo" },
  "k12-verify": { programId: "68d47554aa292d20b9bec8f7", verifyType: "k12teacher", collectStep: "collectTeacherPersonalInfo" },
  "veterans-verify": { programId: "67c8c14f5f17a83b745e3f82", verifyType: "student", collectStep: "collectStudentPersonalInfo" },
  "veterans-extension": { programId: "67c8c14f5f17a83b745e3f82", verifyType: "student", collectStep: "collectStudentPersonalInfo" },
};

const TOOLS_DATA = {
  "spotify-verify": { name: "Spotify Premium", isActive: true },
  "youtube-verify": { name: "YouTube Premium", isActive: true },
  "one-verify": { name: "Gemini Advanced", isActive: true },
  "boltnew-verify": { name: "Bolt.new", isActive: true },
  "canva-teacher": { name: "Canva Education", isActive: true },
  "k12-verify": { name: "ChatGPT Plus", isActive: true },
  "veterans-verify": { name: "Military Verification", isActive: true },
  "veterans-extension": { name: "Chrome Extension", isActive: true },
};

const UNIVERSITIES = [
  { orgId: 2565, name: "Pennsylvania State University", domain: "psu.edu", country: "USA", weight: 100 },
  { orgId: 3499, name: "University of California, Los Angeles", domain: "ucla.edu", country: "USA", weight: 98 },
  { orgId: 1445, name: "University of Texas at Austin", domain: "utexas.edu", country: "USA", weight: 95 },
  { orgId: 2233, name: "Ohio State University", domain: "osu.edu", country: "USA", weight: 92 },
  { orgId: 1876, name: "University of Florida", domain: "ufl.edu", country: "USA", weight: 90 },
  { orgId: 3321, name: "Arizona State University", domain: "asu.edu", country: "USA", weight: 88 },
  { orgId: 4455, name: "University of Michigan", domain: "umich.edu", country: "USA", weight: 85 },
  { orgId: 5566, name: "University of Washington", domain: "uw.edu", country: "USA", weight: 82 },
  { orgId: 6677, name: "Boston University", domain: "bu.edu", country: "USA", weight: 80 },
  { orgId: 7788, name: "New York University", domain: "nyu.edu", country: "USA", weight: 78 },
  { orgId: 10001, name: "University of Oxford", domain: "ox.ac.uk", country: "UK", weight: 75 },
  { orgId: 10002, name: "University of Cambridge", domain: "cam.ac.uk", country: "UK", weight: 73 },
  { orgId: 10003, name: "Imperial College London", domain: "imperial.ac.uk", country: "UK", weight: 70 },
  { orgId: 20001, name: "University of Tokyo", domain: "u-tokyo.ac.jp", country: "Japan", weight: 68 },
  { orgId: 20002, name: "Kyoto University", domain: "kyoto-u.ac.jp", country: "Japan", weight: 65 },
  { orgId: 30001, name: "Seoul National University", domain: "snu.ac.kr", country: "South Korea", weight: 63 },
  { orgId: 30002, name: "Korea University", domain: "korea.ac.kr", country: "South Korea", weight: 60 },
  { orgId: 40001, name: "University of Toronto", domain: "utoronto.ca", country: "Canada", weight: 72 },
  { orgId: 40002, name: "University of British Columbia", domain: "ubc.ca", country: "Canada", weight: 70 },
  { orgId: 50001, name: "University of Melbourne", domain: "unimelb.edu.au", country: "Australia", weight: 67 },
  { orgId: 50002, name: "University of Sydney", domain: "sydney.edu.au", country: "Australia", weight: 65 },
  { orgId: 60001, name: "FPT University", domain: "fpt.edu.vn", country: "Vietnam", weight: 80 },
  { orgId: 60002, name: "VNU University of Science", domain: "hus.vnu.edu.vn", country: "Vietnam", weight: 78 },
  { orgId: 70001, name: "Technical University of Munich", domain: "tum.de", country: "Germany", weight: 62 },
  { orgId: 80001, name: "Sorbonne University", domain: "sorbonne-universite.fr", country: "France", weight: 60 },
  { orgId: 651379, name: "Pennsylvania State University-World Campus", domain: "psu.edu", country: "USA", weight: 95 },
  { orgId: 8387, name: "Pennsylvania State University-Penn State Harrisburg", domain: "psu.edu", country: "USA", weight: 90 },
  { orgId: 8382, name: "Pennsylvania State University-Penn State Altoona", domain: "psu.edu", country: "USA", weight: 88 },
  { orgId: 8396, name: "Pennsylvania State University-Penn State Berks", domain: "psu.edu", country: "USA", weight: 85 },
  { orgId: 8379, name: "Pennsylvania State University-Penn State Brandywine", domain: "psu.edu", country: "USA", weight: 83 },
  { orgId: 2560, name: "Pennsylvania State University-College of Medicine", domain: "psu.edu", country: "USA", weight: 80 },
  { orgId: 650600, name: "Pennsylvania State University-Penn State Lehigh Valley", domain: "psu.edu", country: "USA", weight: 78 },
  { orgId: 8388, name: "Pennsylvania State University-Penn State Hazleton", domain: "psu.edu", country: "USA", weight: 76 },
  { orgId: 8394, name: "Pennsylvania State University-Penn State Worthington Scranton", domain: "psu.edu", country: "USA", weight: 74 },
];

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

function parseVerificationId(url) {
  const match = url.match(/verificationId=([a-f0-9-]+)/i);
  if (match) return match[1].replace(/-/g, "");
  return null;
}

function parseExternalUserId(url) {
  const match = url.match(/externalUserId=([^&]+)/i);
  if (match) return match[1];
  return null;
}

function generateDeviceFingerprint() {
  return crypto.randomBytes(16).toString("hex");
}

const firstNames = [
  "James","Mary","Robert","Patricia","John","Jennifer","Michael","Linda","David","Elizabeth",
  "William","Barbara","Richard","Susan","Joseph","Jessica","Thomas","Sarah","Christopher","Karen",
  "Charles","Lisa","Daniel","Nancy","Matthew","Betty","Anthony","Margaret","Mark","Sandra",
  "Donald","Ashley","Steven","Dorothy","Andrew","Kimberly","Paul","Emily","Joshua","Donna",
  "Kenneth","Michelle","Kevin","Carol","Brian","Amanda","George","Melissa","Timothy","Deborah",
  "Ronald","Stephanie","Edward","Rebecca","Jason","Sharon","Jeffrey","Laura","Ryan","Cynthia",
];
const lastNames = [
  "Smith","Johnson","Williams","Brown","Jones","Garcia","Miller","Davis","Rodriguez","Martinez",
  "Hernandez","Lopez","Gonzalez","Wilson","Anderson","Thomas","Taylor","Moore","Jackson","Martin",
  "Lee","Perez","Thompson","White","Harris","Sanchez","Clark","Ramirez","Lewis","Robinson",
  "Walker","Young","Allen","King","Wright","Scott","Torres","Nguyen","Hill","Flores",
  "Green","Adams","Nelson","Baker","Hall","Rivera","Campbell","Mitchell","Carter","Roberts",
];

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function generateRandomName() {
  return { firstName: pick(firstNames), lastName: pick(lastNames) };
}

function generateEmail(firstName, lastName, domain = "psu.edu") {
  const digits = Math.floor(Math.random() * 9000 + 1000);
  return `${firstName.toLowerCase()}.${lastName.toLowerCase()}${digits}@${domain.toLowerCase()}`;
}

function generateBirthDate(type) {
  if (type === "teacher" || type === "k12teacher") {
    const year = 1970 + Math.floor(Math.random() * 30);
    const month = String(Math.floor(Math.random() * 12) + 1).padStart(2, "0");
    const day = String(Math.floor(Math.random() * 28) + 1).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  const year = 2000 + Math.floor(Math.random() * 6);
  const month = String(Math.floor(Math.random() * 12) + 1).padStart(2, "0");
  const day = String(Math.floor(Math.random() * 28) + 1).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function generateStudentId() {
  return `${Math.floor(100000000 + Math.random() * 900000000)}`;
}

async function sheeridRequest(method, url, body) {
  const options = {
    method,
    headers: { "Content-Type": "application/json", "Accept": "application/json" },
    signal: AbortSignal.timeout(30000),
  };
  if (body) options.body = JSON.stringify(body);
  const response = await fetch(url, options);
  let data;
  const text = await response.text();
  try { data = JSON.parse(text); } catch { data = text; }
  return { data, status: response.status };
}

async function searchOrganization(verificationId, searchTerm) {
  try {
    const url = `${SHEERID_BASE_URL}/rest/v2/verification/${verificationId}/organization?searchTerm=${encodeURIComponent(searchTerm)}`;
    const { data, status } = await sheeridRequest("GET", url);
    if (status === 200 && Array.isArray(data) && data.length > 0) {
      return { id: data[0].id, name: data[0].name };
    }
    return null;
  } catch { return null; }
}

async function uploadToS3(uploadUrl, data, mimeType) {
  try {
    const response = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": mimeType },
      body: data,
      signal: AbortSignal.timeout(60000),
    });
    return response.status >= 200 && response.status < 300;
  } catch { return false; }
}

function generateDocumentPdf(firstName, lastName, verifyType, organizationName) {
  const name = `${firstName} ${lastName}`;
  const dateStr = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth();
  const semester = currentMonth >= 0 && currentMonth <= 4 ? "Spring" : currentMonth >= 5 && currentMonth <= 7 ? "Summer" : "Fall";
  const termStr = `${semester} ${currentYear}`;
  const majors = ["Computer Science","Biology","Psychology","Business Administration","Engineering","English Literature","Mathematics","Economics"];
  const major = pick(majors);
  const credits = Math.floor(Math.random() * 6 + 12);
  const studentId = generateStudentId();

  let content;
  if (verifyType === "student") {
    content = [
      organizationName,
      "Office of the Registrar",
      "",
      `Date: ${dateStr}`,
      "",
      "ENROLLMENT VERIFICATION",
      "",
      `Student Name: ${name}`,
      `Student ID: ${studentId}`,
      `Enrollment Status: Active - Full Time`,
      `Current Term: ${termStr}`,
      `Program / Major: ${major}`,
      `Degree Level: Bachelor's Degree`,
      `Credits Enrolled: ${credits}`,
      "",
      `This letter serves as official confirmation that ${name} is currently enrolled at ${organizationName}.`,
      "",
      "University Registrar",
      organizationName,
    ].join("\n");
  } else {
    const titles = ["Associate Professor","Assistant Professor","Lecturer","Instructor"];
    const departments = ["Department of Computer Science","Department of Biology","Department of Mathematics"];
    content = [
      organizationName,
      "Human Resources Department",
      "",
      `Date: ${dateStr}`,
      "",
      "EMPLOYMENT VERIFICATION",
      "",
      `Employee Name: ${name}`,
      `Position: ${pick(titles)}`,
      `Department: ${pick(departments)}`,
      `Employment Status: Active - Full Time`,
      `Employment Type: Faculty`,
      `Hire Date: August 15, 2018`,
      "",
      `This letter confirms the employment of ${name} at ${organizationName}.`,
      "",
      "Director of Human Resources",
      organizationName,
    ].join("\n");
  }

  return Buffer.from(content, "utf-8");
}

async function runVerification(params) {
  const { toolId, verificationId, firstName, lastName, email, birthDate, organizationId, organizationName, url } = params;
  const config = TOOL_CONFIGS[toolId];
  if (!config) return { success: false, pending: false, message: `No configuration for tool: ${toolId}`, verificationId, steps: [] };

  const steps = [];
  const deviceFingerprint = generateDeviceFingerprint();
  const externalUserId = parseExternalUserId(url);

  try {
    const docData = generateDocumentPdf(firstName, lastName, config.verifyType, organizationName);
    const documents = [{ fileName: "verification_document.png", data: docData, mimeType: "image/png" }];
    steps.push({ step: "generateDocument", status: 200, data: { count: 1 } });

    const personalInfoBody = {
      firstName, lastName, birthDate, email, phoneNumber: "",
      organization: { id: organizationId, idExtended: String(organizationId), name: organizationName },
      deviceFingerprintHash: deviceFingerprint,
      locale: "en-US",
      metadata: {
        marketConsentValue: false,
        refererUrl: `${SHEERID_BASE_URL}/verify/${config.programId}/?verificationId=${verificationId}`,
        verificationId,
        submissionOptIn: "By submitting the personal information above, I acknowledge that my personal information is being collected under the privacy policy of the business from which I am seeking a discount",
      },
    };

    if (config.verifyType === "teacher" && externalUserId) {
      personalInfoBody.externalUserId = externalUserId;
      personalInfoBody.metadata.externalUserId = externalUserId;
      personalInfoBody.metadata.refererUrl = url;
    }

    if (config.collectStep === "collectStudentPersonalInfo") {
      personalInfoBody.metadata.flags = '{"collect-info-step-email-first":"default","doc-upload-considerations":"default","doc-upload-may24":"default","doc-upload-redesign-use-legacy-message-keys":false,"docUpload-assertion-checklist":"default","font-size":"default","include-cvec-field-france-student":"not-labeled-optional"}';
    }

    const step2 = await sheeridRequest("POST", `${SHEERID_BASE_URL}/rest/v2/verification/${verificationId}/step/${config.collectStep}`, personalInfoBody);
    steps.push({ step: config.collectStep, status: step2.status, data: step2.data });

    if (step2.status !== 200) {
      return { success: false, pending: false, message: `Personal info submission failed (HTTP ${step2.status})`, verificationId, steps };
    }

    if (step2.data?.currentStep === "error") {
      return { success: false, pending: false, message: `SheerID error: ${(step2.data.errorIds || []).join(", ")}`, verificationId, errorIds: step2.data.errorIds, steps };
    }

    let currentStep = step2.data?.currentStep || "";

    if (currentStep === "sso" || currentStep === config.collectStep) {
      const step3 = await sheeridRequest("DELETE", `${SHEERID_BASE_URL}/rest/v2/verification/${verificationId}/step/sso`);
      steps.push({ step: "skipSSO", status: step3.status, data: step3.data });
      currentStep = step3.data?.currentStep || currentStep;
    }

    if (currentStep === "success") {
      return { success: true, pending: false, message: "Verification approved instantly", verificationId, currentStep, redirectUrl: step2.data?.redirectUrl, steps };
    }

    const docUploadBody = { files: documents.map(doc => ({ fileName: doc.fileName, mimeType: doc.mimeType, fileSize: doc.data.length })) };
    const step4 = await sheeridRequest("POST", `${SHEERID_BASE_URL}/rest/v2/verification/${verificationId}/step/docUpload`, docUploadBody);
    steps.push({ step: "docUpload", status: step4.status, data: step4.data });

    if (!step4.data?.documents || step4.data.documents.length === 0) {
      return { success: false, pending: false, message: "Failed to get upload URL", verificationId, steps };
    }

    let allUploaded = true;
    for (let i = 0; i < step4.data.documents.length && i < documents.length; i++) {
      const uploadUrl = step4.data.documents[i].uploadUrl;
      const doc = documents[i];
      const uploaded = await uploadToS3(uploadUrl, doc.data, doc.mimeType);
      if (!uploaded) allUploaded = false;
    }

    if (!allUploaded) {
      return { success: false, pending: false, message: "Document upload to S3 failed", verificationId, steps };
    }

    const step5 = await sheeridRequest("POST", `${SHEERID_BASE_URL}/rest/v2/verification/${verificationId}/step/completeDocUpload`);
    steps.push({ step: "completeDocUpload", status: step5.status, data: step5.data });

    const finalStep = step5.data?.currentStep || "unknown";
    const redirectUrl = step5.data?.redirectUrl;

    if (finalStep === "success") {
      return { success: true, pending: false, message: "Verification successful", verificationId, currentStep: finalStep, redirectUrl, steps };
    }

    return { success: true, pending: true, message: "Document submitted, awaiting review", verificationId, currentStep: finalStep, redirectUrl, steps };
  } catch (error) {
    return {
      success: false, pending: false,
      message: error.name === "TimeoutError" ? "SheerID API request timed out" : `Verification failed: ${error.message}`,
      verificationId, steps
    };
  }
}

async function checkVerificationStatus(verificationId) {
  const { data, status } = await sheeridRequest("GET", `${MY_SHEERID_URL}/rest/v2/verification/${verificationId}`);
  if (status !== 200) throw new Error(`Status check failed (HTTP ${status})`);
  return {
    currentStep: data?.currentStep || "unknown",
    rewardCode: data?.rewardCode || data?.rewardData?.rewardCode,
    redirectUrl: data?.redirectUrl,
    errorIds: data?.errorIds,
  };
}

const bot = new TelegramBot(BOT_TOKEN, { polling: true });
console.log("[Telegram] Bot started with polling");

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
            if (referrer && referrer.telegramId !== telegramId) {
              addTokens(referrer.telegramId, REFERRAL_REWARD);
              try {
                await bot.sendMessage(parseInt(referrer.telegramId), `Someone joined using your referral link! You earned ${REFERRAL_REWARD} tokens.`);
              } catch {}
            }
          }

          await bot.answerCallbackQuery(query.id, { text: `Verified! You earned ${JOIN_REWARD} tokens!` });
          await bot.sendMessage(chatId,
            `Channel membership verified! You earned ${JOIN_REWARD} tokens.\n\n` +
            `Your balance: ${user.tokens} tokens\n\n` +
            `Available commands:\n` +
            `/verify {link} - Run verification (${VERIFICATION_COST} tokens)\n` +
            `/daily - Claim daily bonus (${DAILY_REWARD} tokens)\n` +
            `/balance - Check your token balance\n` +
            `/referral - Get your referral link`
          );
        } else {
          await bot.answerCallbackQuery(query.id, { text: "You haven't joined the channel yet. Please join first!", show_alert: true });
        }
      } catch (err) {
        console.error("[Telegram] Channel check error:", err.message);
        await bot.answerCallbackQuery(query.id, { text: "Could not verify membership. Make sure you joined the channel and try again.", show_alert: true });
      }
    }
  } catch (err) {
    console.error("[Telegram] Callback query error:", err.message);
  }
});

bot.onText(/\/daily/, async (msg) => {
  const chatId = msg.chat.id;
  const telegramId = msg.from.id.toString();
  const user = getUser(telegramId);

  if (!user) { await bot.sendMessage(chatId, "Please use /start first to register."); return; }
  if (!user.hasJoinedChannel) { await bot.sendMessage(chatId, "Please join the channel and verify first using /start."); return; }

  const now = new Date();
  if (user.lastDaily) {
    const diff = now.getTime() - new Date(user.lastDaily).getTime();
    const hoursLeft = 24 - (diff / (1000 * 60 * 60));
    if (hoursLeft > 0) {
      const h = Math.floor(hoursLeft);
      const m = Math.floor((hoursLeft - h) * 60);
      await bot.sendMessage(chatId, `You already claimed your daily bonus. Come back in ${h}h ${m}m.`);
      return;
    }
  }

  user.lastDaily = now;
  addTokens(telegramId, DAILY_REWARD);
  await bot.sendMessage(chatId, `Daily bonus claimed! +${DAILY_REWARD} tokens\nYour balance: ${user.tokens} tokens`);
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

  let detectedToolId = "spotify-verify";
  const linkLower = link.toLowerCase();
  if (linkLower.includes("spotify")) detectedToolId = "spotify-verify";
  else if (linkLower.includes("youtube")) detectedToolId = "youtube-verify";
  else if (linkLower.includes("google") || linkLower.includes("one.google")) detectedToolId = "one-verify";
  else if (linkLower.includes("bolt")) detectedToolId = "boltnew-verify";
  else if (linkLower.includes("canva")) detectedToolId = "canva-teacher";
  else if (linkLower.includes("chatgpt") || linkLower.includes("openai")) detectedToolId = "k12-verify";

  const config = TOOL_CONFIGS[detectedToolId];
  const tool = TOOLS_DATA[detectedToolId];
  if (!config || !tool || !tool.isActive) { await bot.sendMessage(chatId, "This verification tool is currently disabled."); return; }

  const deducted = deductTokens(telegramId, VERIFICATION_COST);
  if (!deducted) { await bot.sendMessage(chatId, "Failed to deduct tokens. Please try again."); return; }

  const statusMsg = await bot.sendMessage(chatId,
    `Verification started for ${tool.name}...\nTokens deducted: ${VERIFICATION_COST}\nPlease wait, this may take a few minutes.`
  );

  let tokensRefunded = false;
  try {
    const totalWeight = UNIVERSITIES.reduce((sum, u) => sum + u.weight, 0);
    let rand = Math.random() * totalWeight;
    let university = UNIVERSITIES[0];
    for (const u of UNIVERSITIES) {
      rand -= u.weight;
      if (rand <= 0) { university = u; break; }
    }

    let resolvedOrgId = university.orgId;
    let resolvedOrgName = university.name;
    const sheeridOrg = await searchOrganization(verificationId, university.name);
    if (sheeridOrg) {
      resolvedOrgId = sheeridOrg.id;
      resolvedOrgName = sheeridOrg.name;
    }

    const { firstName, lastName } = generateRandomName();
    const domain = university.domain || "psu.edu";
    const email = generateEmail(firstName, lastName, domain);
    const birthDate = generateBirthDate(config.verifyType);

    const result = await runVerification({
      toolId: detectedToolId, verificationId, firstName, lastName, email, birthDate,
      organizationId: resolvedOrgId, organizationName: resolvedOrgName, url: link,
    });

    let finalStatus = "failed";
    let errorMsg = null;
    let finalRedirectUrl = result.redirectUrl;

    if (result.success && !result.pending) {
      finalStatus = "success";
    } else if (result.success && result.pending) {
      try {
        await bot.editMessageText(
          `Verification in progress for ${tool.name}...\nDocument submitted, waiting for SheerID review.\nThis can take up to 5 minutes.`,
          { chat_id: chatId, message_id: statusMsg.message_id }
        );
      } catch {}

      let resolved = false;
      for (let i = 0; i < 30; i++) {
        await new Promise(r => setTimeout(r, 10000));
        try {
          const pollResult = await checkVerificationStatus(verificationId);
          if (pollResult.currentStep === "success") {
            finalStatus = "success"; finalRedirectUrl = pollResult.redirectUrl || finalRedirectUrl; resolved = true; break;
          } else if (pollResult.currentStep === "error" || (pollResult.errorIds && pollResult.errorIds.length > 0)) {
            finalStatus = "failed"; errorMsg = `Verification rejected: ${(pollResult.errorIds || []).join(", ") || "document review failed"}`; resolved = true; break;
          }
        } catch {}
      }
      if (!resolved) { finalStatus = "failed"; errorMsg = "Verification timed out waiting for SheerID review"; }
    } else {
      finalStatus = "failed"; errorMsg = result.message;
    }

    statsData.totalAttempts++;
    if (finalStatus === "success") {
      statsData.successCount++;
      let successText = `Verification successful!\n\nTool: ${tool.name}\nName: ${firstName} ${lastName}\nEmail: ${email}\nUniversity: ${resolvedOrgName}\nBalance: ${user.tokens} tokens`;
      if (finalRedirectUrl) successText += `\n\nClaim your offer: ${finalRedirectUrl}`;
      await bot.sendMessage(chatId, successText);
    } else {
      statsData.failedCount++;
      if (!tokensRefunded) { addTokens(telegramId, VERIFICATION_COST); tokensRefunded = true; }
      await bot.sendMessage(chatId,
        `Verification failed. Your ${VERIFICATION_COST} tokens have been refunded.\n\nReason: ${errorMsg || "Unknown error"}\n\nYour balance: ${user.tokens} tokens`
      );
    }
  } catch (err) {
    if (!tokensRefunded) { addTokens(telegramId, VERIFICATION_COST); tokensRefunded = true; }
    await bot.sendMessage(chatId,
      `An error occurred during verification. Your ${VERIFICATION_COST} tokens have been refunded.\n\nError: ${err.message || "Unknown error"}\n\nYour balance: ${user.tokens} tokens`
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
      `System Stats:\n\nTotal Users: ${allUsers.length}\nTotal Verifications: ${statsData.totalAttempts}\n` +
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

console.log("[Bot] Standalone bot is running. Press Ctrl+C to stop.");
