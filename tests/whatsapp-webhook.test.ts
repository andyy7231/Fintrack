import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { db } from "@/lib/db";
import {
  user,
  accounts,
  categories,
  transactions,
  transfers,
  whatsappContacts,
  whatsappMessages,
  whatsappVerificationChallenges,
} from "@/db/schema";
import {
  WhatsAppWebhookService,
  WhatsAppMessageService,
  WhatsAppVerificationService,
  UserMappingService,
  WhatsAppClient,
  IWhatsAppClient,
  normalizePhoneNumber,
  verifyWebhookSignature,
  generateWebhookSignature,
  extractInboundMessages,
  getWhatsAppConfig,
  getWhatsAppGraphApiUrl,
} from "@/services/whatsapp";
import { checkRateLimit } from "@/lib/utils/rate-limit";
import { GET, POST } from "@/app/api/webhooks/whatsapp/route";
import { NextRequest } from "next/server";
import { eq, inArray } from "drizzle-orm";

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`ASSERTION FAILED: ${message}`);
  }
}

// Mock WhatsApp Outbound Client to capture calls without hitting external network
class MockWhatsAppClient implements IWhatsAppClient {
  public sentMessages: Array<{ to: string; text: string }> = [];

  async sendTextMessage(params: {
    to: string;
    text: string;
  }): Promise<{ success: boolean; messageId: string }> {
    this.sentMessages.push(params);
    return {
      success: true,
      messageId: `mock_wamid_${Date.now()}_${Math.random().toString(36).substring(7)}`,
    };
  }

  reset() {
    this.sentMessages = [];
  }
}

async function runWhatsAppTests() {
  console.log("====================================================");
  console.log("   FINTRACK PHASE 4 — WHATSAPP WEBHOOK TESTS       ");
  console.log("====================================================");

  const ts = Date.now();
  const userAId = `p4_user_a_${ts}`;
  const userBId = `p4_user_b_${ts}`;
  const userAPhone = "+6281234567890";
  const userBPhone = "+6289876543210";
  const unlinkedPhone = "+6281112223334";

  const config = getWhatsAppConfig();
  const appSecret = config.appSecret || "fintrack_wa_app_secret_test_2026";
  const verifyToken = config.verifyToken || "fintrack_wa_verify_token_2026";

  const mockClient = new MockWhatsAppClient();

  // Pre-clean test contacts to prevent collision with interrupted test runs
  await db
    .delete(whatsappContacts)
    .where(
      inArray(whatsappContacts.phoneNumber, [
        userAPhone,
        userBPhone,
        unlinkedPhone,
        "+6287778889990",
        "+6285556667770",
        "+6289998887770",
        "+6281122334455",
      ])
    );

  // Create test users in DB
  await db.insert(user).values([
    {
      id: userAId,
      name: "User Alpha P4",
      email: `${userAId}@test.com`,
      currency: "IDR",
      timezone: "Asia/Jakarta",
    },
    {
      id: userBId,
      name: "User Beta P4",
      email: `${userBId}@test.com`,
      currency: "IDR",
      timezone: "Asia/Jakarta",
    },
  ]);

  try {
    // ------------------------------------------------------------------
    // TEST 1: Webhook GET Verification
    // ------------------------------------------------------------------
    console.log("\n[TEST 1] Webhook GET verification...");

    // 1a: Valid token and mode
    const directVerify = WhatsAppWebhookService.verifyWebhook("subscribe", verifyToken, "123456789");
    assert(directVerify.isValid && directVerify.challenge === "123456789", "Direct verify must pass");

    const validUrl = `http://localhost:3000/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=${verifyToken}&hub.challenge=123456789`;
    const getReqValid = new NextRequest(validUrl);
    const getResValid = await GET(getReqValid);
    assert(getResValid.status === 200, `Expected status 200 for valid token, got ${getResValid.status}`);
    const bodyValid = await getResValid.text();
    assert(bodyValid === "123456789", `Expected challenge 123456789, got ${bodyValid}`);
    console.log("✓ PASS: Valid verify token accepted with challenge response");

    // 1b: Invalid token
    const invalidUrl = `http://localhost:3000/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=wrong_token&hub.challenge=123456789`;
    const getReqInvalid = new NextRequest(invalidUrl);
    const getResInvalid = await GET(getReqInvalid);
    assert(getResInvalid.status === 403, `Expected status 403 for invalid token, got ${getResInvalid.status}`);
    console.log("✓ PASS: Invalid verify token rejected (403)");

    // 1c: Invalid mode
    const invalidModeUrl = `http://localhost:3000/api/webhooks/whatsapp?hub.mode=unsubscribe&hub.verify_token=${verifyToken}&hub.challenge=123456789`;
    const getReqMode = new NextRequest(invalidModeUrl);
    const getResMode = await GET(getReqMode);
    assert(getResMode.status === 403, `Expected status 403 for invalid mode, got ${getResMode.status}`);
    console.log("✓ PASS: Invalid mode rejected (403)");

    // ------------------------------------------------------------------
    // TEST 2: Webhook POST - Invalid Signature Validation
    // ------------------------------------------------------------------
    console.log("\n[TEST 2] Invalid signature rejection...");
    const samplePayload = JSON.stringify({
      object: "whatsapp_business_account",
      entry: [],
    });

    // 2a: Wrong signature
    const postReqBadSig = new NextRequest("http://localhost:3000/api/webhooks/whatsapp", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-hub-signature-256": "sha256=bad0000000000000000000000000000000000000000000000000000000000000",
      },
      body: samplePayload,
    });
    const postResBadSig = await POST(postReqBadSig);
    assert(postResBadSig.status === 401, `Expected status 401 for bad signature, got ${postResBadSig.status}`);
    console.log("✓ PASS: Tampered / bad signature rejected (401)");

    // 2b: Missing signature header
    const postReqNoSig = new NextRequest("http://localhost:3000/api/webhooks/whatsapp", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: samplePayload,
    });
    const postResNoSig = await POST(postReqNoSig);
    assert(postResNoSig.status === 401, `Expected status 401 for missing signature, got ${postResNoSig.status}`);
    console.log("✓ PASS: Missing signature rejected (401)");

    // ------------------------------------------------------------------
    // TEST 3: Webhook POST - Valid Signature Validation
    // ------------------------------------------------------------------
    console.log("\n[TEST 3] Valid signature acceptance...");
    const validSig = generateWebhookSignature(samplePayload, appSecret);
    assert(verifyWebhookSignature(samplePayload, validSig, appSecret), "Signature verification must succeed");

    const postReqValidSig = new NextRequest("http://localhost:3000/api/webhooks/whatsapp", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-hub-signature-256": validSig,
      },
      body: samplePayload,
    });
    const postResValidSig = await POST(postReqValidSig);
    assert(postResValidSig.status === 200, `Expected status 200 for valid signature, got ${postResValidSig.status}`);
    console.log("✓ PASS: Valid signature correctly accepted (200)");

    // ------------------------------------------------------------------
    // TEST 4: Text Message Parsing & Normalization
    // ------------------------------------------------------------------
    console.log("\n[TEST 4] Text message payload parsing & adapter normalization...");
    const rawWebhookBody = {
      object: "whatsapp_business_account",
      entry: [
        {
          id: "WABA_ID_TEST",
          changes: [
            {
              field: "messages",
              value: {
                messaging_product: "whatsapp",
                metadata: {
                  display_phone_number: "62800000000",
                  phone_number_id: "100012345678901",
                },
                contacts: [
                  {
                    profile: { name: "Alpha Tester" },
                    wa_id: "6281234567890",
                  },
                ],
                messages: [
                  {
                    from: "6281234567890",
                    id: `wamid.TEST_MSG_4_${ts}`,
                    timestamp: "1727500000",
                    type: "text",
                    text: {
                      body: "Halo FinTrack, ini pesan percobaan",
                    },
                  },
                ],
              },
            },
          ],
        },
      ],
    };

    const parsedMessages = extractInboundMessages(rawWebhookBody);
    assert(parsedMessages.length === 1, `Expected 1 normalized message, got ${parsedMessages.length}`);
    const [msg4] = parsedMessages;
    assert(msg4.providerMessageId === `wamid.TEST_MSG_4_${ts}`, "Provider message ID mismatch");
    assert(msg4.phoneNumber === "6281234567890", "Raw phone number mismatch");
    assert(msg4.normalizedPhoneNumber === "+6281234567890", `Expected +6281234567890, got ${msg4.normalizedPhoneNumber}`);
    assert(msg4.messageType === "text", "Message type mismatch");
    assert(msg4.text === "Halo FinTrack, ini pesan percobaan", "Message text mismatch");
    assert(msg4.senderName === "Alpha Tester", "Sender name mismatch");
    assert(msg4.receivedAt.getTime() === 1727500000 * 1000, "Timestamp mismatch");
    console.log("✓ PASS: Meta webhook payload normalized to internal DTO");

    // ------------------------------------------------------------------
    // TEST 5: User Mapping (Known vs Unknown Phone)
    // ------------------------------------------------------------------
    console.log("\n[TEST 5] User mapping...");

    // Link user A to userAPhone
    const contactA = await UserMappingService.linkPhoneNumber(userAId, userAPhone);
    assert(contactA.userId === userAId, "Contact user ID mismatch");
    assert(contactA.phoneNumber === userAPhone, "Contact phone mismatch");
    assert(contactA.isActive === true, "Contact must be active");

    // Lookup known phone
    const resolvedA = await UserMappingService.findUserByPhoneNumber(userAPhone);
    assert(resolvedA !== null, "Resolved user A should not be null");
    assert(resolvedA?.userId === userAId, "Resolved user A ID mismatch");
    console.log("✓ PASS: Known phone number maps to correct internal user");

    // Lookup unknown phone
    const resolvedUnknown = await UserMappingService.findUserByPhoneNumber(unlinkedPhone);
    assert(resolvedUnknown === null, "Unknown phone number should map to null");
    console.log("✓ PASS: Unknown phone number maps to null (no user data found)");

    // ------------------------------------------------------------------
    // TEST 6: Phone Normalization (E.164 Canonical Resolution)
    // ------------------------------------------------------------------
    console.log("\n[TEST 6] Phone normalization test cases...");
    const phoneCases = [
      { input: "+62 812-3456-7890", expected: "+6281234567890" },
      { input: "081234567890", expected: "+6281234567890" },
      { input: "6281234567890", expected: "+6281234567890" },
      { input: "+6281234567890", expected: "+6281234567890" },
      { input: "0812-3456-7890", expected: "+6281234567890" },
      { input: "0812 3456 7890", expected: "+6281234567890" },
      { input: "+1 (555) 123-4567", expected: "+15551234567" },
    ];

    for (const testCase of phoneCases) {
      const normalized = normalizePhoneNumber(testCase.input);
      assert(
        normalized === testCase.expected,
        `Phone "${testCase.input}": expected "${testCase.expected}", got "${normalized}"`
      );
    }
    console.log("✓ PASS: All variations resolved to canonical E.164 representation");

    // ------------------------------------------------------------------
    // TEST 7: Idempotency (Duplicate Webhook Delivery)
    // ------------------------------------------------------------------
    console.log("\n[TEST 7] Idempotency duplicate webhook handling...");
    mockClient.reset();

    const dedupMsgId = `wamid.DEDUP_TEST_${ts}`;
    const inboundDedup = {
      providerMessageId: dedupMsgId,
      phoneNumber: "081234567890",
      normalizedPhoneNumber: "+6281234567890",
      messageType: "text",
      text: "Halo tes idempotensi",
      receivedAt: new Date(),
    };

    // First delivery
    const result1 = await WhatsAppMessageService.processInboundMessage(inboundDedup, mockClient);
    assert(result1.isDuplicate === false, "First delivery should not be duplicate");
    assert(result1.status === "PROCESSED", `Expected status PROCESSED, got ${result1.status}`);
    assert(mockClient.sentMessages.length === 1, `Expected 1 outbound message, got ${mockClient.sentMessages.length}`);

    // Second delivery (duplicate retry by Meta)
    const result2 = await WhatsAppMessageService.processInboundMessage(inboundDedup, mockClient);
    assert(result2.isDuplicate === true, "Second delivery must be marked as duplicate");
    assert(result2.status === "DUPLICATE", `Expected status DUPLICATE, got ${result2.status}`);
    assert(mockClient.sentMessages.length === 1, "Duplicate delivery must NOT send a second outbound message");

    // Third delivery
    const result3 = await WhatsAppMessageService.processInboundMessage(inboundDedup, mockClient);
    assert(result3.isDuplicate === true, "Third delivery must be marked as duplicate");
    assert(mockClient.sentMessages.length === 1, "Third delivery must NOT send additional outbound message");

    // Verify database has exactly 1 row with this whatsapp_message_id
    const rows = await db
      .select()
      .from(whatsappMessages)
      .where(eq(whatsappMessages.whatsappMessageId, dedupMsgId));
    assert(rows.length === 1, `Expected exactly 1 database record, found ${rows.length}`);
    console.log("✓ PASS: Idempotent processing verified (1 DB record, 1 reply sent)");

    // ------------------------------------------------------------------
    // TEST 8: Unsupported Message Types
    // ------------------------------------------------------------------
    console.log("\n[TEST 8] Unsupported message type handling...");
    mockClient.reset();

    const imageMsgId = `wamid.IMAGE_TEST_${ts}`;
    const inboundImage = {
      providerMessageId: imageMsgId,
      phoneNumber: "081234567890",
      normalizedPhoneNumber: "+6281234567890",
      messageType: "image",
      text: null,
      receivedAt: new Date(),
      rawPayload: { image: { id: "media_123" } },
    };

    const imgResult = await WhatsAppMessageService.processInboundMessage(inboundImage, mockClient);
    assert(imgResult.status === "UNSUPPORTED", `Expected UNSUPPORTED status, got ${imgResult.status}`);
    assert(mockClient.sentMessages.length === 1, "Should send unsupported message notification");
    assert(
      mockClient.sentMessages[0].text.includes("Format pesan tidak didukung"),
      "Outbound message text should indicate unsupported format"
    );
    console.log("✓ PASS: Unsupported message type handled gracefully without crash");

    // ------------------------------------------------------------------
    // TEST 9: CRITICAL FINANCIAL ISOLATION RULE
    // ------------------------------------------------------------------
    console.log("\n[TEST 9] CRITICAL: Financial isolation verification...");

    // Record initial counts and account balances
    const initialTxCount = (await db.select().from(transactions)).length;
    const initialTransferCount = (await db.select().from(transfers)).length;
    const initialAccountCount = (await db.select().from(accounts)).length;
    const initialCategoryCount = (await db.select().from(categories)).length;

    // Send arbitrary messages mimicking financial transactions
    const financialTestTexts = [
      "Beli kopi Starbucks 55 ribu",
      "Makan siang nasi padang 30000",
      "Transfer uang 500.000 ke rekening BCA",
      "Gaji masuk 10000000",
      "Bayar listrik 250000",
    ];

    for (let i = 0; i < financialTestTexts.length; i++) {
      const msgId = `wamid.FIN_ISOLATION_${i}_${ts}`;
      await WhatsAppMessageService.processInboundMessage(
        {
          providerMessageId: msgId,
          phoneNumber: "081234567890",
          normalizedPhoneNumber: "+6281234567890",
          messageType: "text",
          text: financialTestTexts[i],
          receivedAt: new Date(),
        },
        mockClient
      );
    }

    // Verify absolutely ZERO financial mutations took place
    const finalTxCount = (await db.select().from(transactions)).length;
    const finalTransferCount = (await db.select().from(transfers)).length;
    const finalAccountCount = (await db.select().from(accounts)).length;
    const finalCategoryCount = (await db.select().from(categories)).length;

    assert(
      finalTxCount === initialTxCount,
      `FINANCIAL SAFETY BREACH: Transactions changed from ${initialTxCount} to ${finalTxCount}!`
    );
    assert(
      finalTransferCount === initialTransferCount,
      `FINANCIAL SAFETY BREACH: Transfers changed from ${initialTransferCount} to ${finalTransferCount}!`
    );
    assert(
      finalAccountCount === initialAccountCount,
      `FINANCIAL SAFETY BREACH: Accounts changed from ${initialAccountCount} to ${finalAccountCount}!`
    );
    assert(
      finalCategoryCount === initialCategoryCount,
      `FINANCIAL SAFETY BREACH: Categories changed from ${initialCategoryCount} to ${finalCategoryCount}!`
    );
    console.log("✓ PASS: Zero financial mutations occurred (100% financial isolation confirmed)");

    // ------------------------------------------------------------------
    // TEST 10: User Isolation (Cross-User Protection)
    // ------------------------------------------------------------------
    console.log("\n[TEST 10] User isolation...");

    // Link User B to userBPhone
    await UserMappingService.linkPhoneNumber(userBId, userBPhone);

    // Verify user B phone resolves to user B, NOT user A
    const mapB = await UserMappingService.findUserByPhoneNumber(userBPhone);
    assert(mapB?.userId === userBId, "User B phone mapped to wrong user");
    assert(mapB?.userId !== userAId, "Cross-user data leakage detected!");

    // Verify User A cannot claim User B's active phone number
    let conflictThrown = false;
    try {
      await UserMappingService.linkPhoneNumber(userAId, userBPhone);
    } catch {
      conflictThrown = true;
    }
    assert(conflictThrown, "Claiming another active user's phone must throw conflict error");

    // Ingest message from User B and verify DB record user_id is userBId
    const msgBId = `wamid.USER_B_MSG_${ts}`;
    const resB = await WhatsAppMessageService.processInboundMessage(
      {
        providerMessageId: msgBId,
        phoneNumber: userBPhone,
        normalizedPhoneNumber: userBPhone,
        messageType: "text",
        text: "Pesan dari user B",
        receivedAt: new Date(),
      },
      mockClient
    );
    assert(resB.userId === userBId, `Expected userId ${userBId}, got ${resB.userId}`);

    const [dbMsgB] = await db
      .select()
      .from(whatsappMessages)
      .where(eq(whatsappMessages.whatsappMessageId, msgBId));
    assert(dbMsgB.userId === userBId, "DB record user_id mismatch for User B message");
    console.log("✓ PASS: User isolation strictly enforced between User A and User B");

    // ------------------------------------------------------------------
    // TEST 11: Outbound WhatsApp Client Mock & Error Handling
    // ------------------------------------------------------------------
    console.log("\n[TEST 11] Outbound WhatsApp client verification...");

    let capturedUrl = "";
    let capturedHeaders: Record<string, string> = {};
    let capturedBody = "";

    const testFetch: typeof fetch = async (url, init) => {
      capturedUrl = url.toString();
      capturedHeaders = init?.headers as Record<string, string>;
      capturedBody = init?.body as string;

      return new Response(
        JSON.stringify({
          messaging_product: "whatsapp",
          contacts: [{ input: userAPhone, wa_id: "6281234567890" }],
          messages: [{ id: "wamid.OUTBOUND_123" }],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    };

    const clientWithMock = new WhatsAppClient(testFetch);
    const sendResult = await clientWithMock.sendTextMessage({
      to: userAPhone,
      text: "Halo dari FinTrack automated client test",
    });

    assert(sendResult.success === true, "Send message must return success = true");
    assert(sendResult.messageId === "wamid.OUTBOUND_123", "Outbound message ID mismatch");
    assert(capturedUrl.includes("/messages"), `URL must point to Meta messages endpoint, got ${capturedUrl}`);
    assert(capturedHeaders["Authorization"]?.startsWith("Bearer "), "Missing Bearer authorization header");
    assert(capturedHeaders["Content-Type"] === "application/json", "Content-Type must be application/json");

    const parsedOutboundBody = JSON.parse(capturedBody);
    assert(parsedOutboundBody.messaging_product === "whatsapp", "messaging_product mismatch");
    assert(parsedOutboundBody.to === userAPhone, "Recipient phone mismatch");
    assert(parsedOutboundBody.text?.body === "Halo dari FinTrack automated client test", "Body text mismatch");

    // Test error handling in outbound client
    const errorFetch: typeof fetch = async () => {
      return new Response(
        JSON.stringify({
          error: {
            message: "(#100) Invalid parameter",
            type: "OAuthException",
            code: 100,
          },
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    };

    const errorClient = new WhatsAppClient(errorFetch);
    const errorResult = await errorClient.sendTextMessage({
      to: "+0000000000",
      text: "Testing error handling",
    });
    assert(errorResult.success === false, "Error response must return success = false");
    assert(Boolean(errorResult.error?.includes("Invalid parameter")), "Error message should contain Meta error description");
    console.log("✓ PASS: Outbound client formatted requests correctly and handled API errors safely");

    // ------------------------------------------------------------------
    // TEST 12: API Version Configuration
    // ------------------------------------------------------------------
    console.log("\n[TEST 12] API Version dynamic configuration...");
    const urlDefault = getWhatsAppGraphApiUrl("123456", "v22.0");
    assert(urlDefault.includes("/v22.0/123456/messages"), `Expected /v22.0/, got ${urlDefault}`);

    const urlCustom = getWhatsAppGraphApiUrl("123456", "v21.0");
    assert(urlCustom.includes("/v21.0/123456/messages"), `Expected /v21.0/, got ${urlCustom}`);
    console.log("✓ PASS: WhatsApp API version dynamically configurable");

    // ------------------------------------------------------------------
    // TEST 13: Phone Ownership Verification Challenge
    // ------------------------------------------------------------------
    console.log("\n[TEST 13] Phone ownership challenge creation & hash verification...");
    const unverifiedPhone = "+6287778889990";
    const challengeReq = await WhatsAppVerificationService.requestVerification(
      userAId,
      unverifiedPhone,
      mockClient
    );
    assert(challengeReq.success === true, "Challenge request must succeed");
    assert(Boolean(challengeReq.devCode && challengeReq.devCode.length === 6), "Challenge must be 6 digits");

    // Verify raw code is NOT stored in DB, only SHA-256 hash
    const [challengeDb] = await db
      .select()
      .from(whatsappVerificationChallenges)
      .where(eq(whatsappVerificationChallenges.id, challengeReq.challengeId));
    assert(Boolean(challengeDb), "Challenge record must exist in DB");
    assert(challengeDb.codeHash.length === 64, "codeHash must be 64-char SHA-256 hex string");
    assert(challengeDb.codeHash !== challengeReq.devCode, "Code must be hashed, never stored in plaintext");

    // Verify valid code verifies contact
    const verifyResult = await WhatsAppVerificationService.verifyCode(
      userAId,
      unverifiedPhone,
      challengeReq.devCode!
    );
    assert(verifyResult.success === true, "Valid code verification must succeed");

    const [verifiedContact] = await db
      .select()
      .from(whatsappContacts)
      .where(eq(whatsappContacts.phoneNumber, unverifiedPhone));
    assert(verifiedContact.verifiedAt !== null, "Contact verifiedAt must be populated");
    assert(verifiedContact.isActive === true, "Contact must be active");
    console.log("✓ PASS: Phone ownership challenge created, securely hashed, and verified");

    // ------------------------------------------------------------------
    // TEST 14: Expired Verification Challenge
    // ------------------------------------------------------------------
    console.log("\n[TEST 14] Expired verification challenge rejection...");
    const expiredPhone = "+6285556667770";
    const expChallenge = await WhatsAppVerificationService.requestVerification(
      userAId,
      expiredPhone,
      mockClient
    );
    // Artificially expire the challenge in DB
    await db
      .update(whatsappVerificationChallenges)
      .set({ expiresAt: new Date(Date.now() - 60000) })
      .where(eq(whatsappVerificationChallenges.id, expChallenge.challengeId));

    const expVerify = await WhatsAppVerificationService.verifyCode(
      userAId,
      expiredPhone,
      expChallenge.devCode!
    );
    assert(expVerify.success === false, "Expired challenge must be rejected");
    assert(Boolean(expVerify.error?.includes("kadaluarsa")), "Error message must indicate expiration");
    console.log("✓ PASS: Expired verification challenge successfully rejected");

    // ------------------------------------------------------------------
    // TEST 15: Reused Verification Challenge
    // ------------------------------------------------------------------
    console.log("\n[TEST 15] Reused verification challenge rejection...");
    // Attempt verifying the already-used challenge from Test 13
    const reuseVerify = await WhatsAppVerificationService.verifyCode(
      userAId,
      unverifiedPhone,
      challengeReq.devCode!
    );
    assert(reuseVerify.success === false, "Reused challenge must be rejected");
    console.log("✓ PASS: Single-use challenge cannot be reused");

    // ------------------------------------------------------------------
    // TEST 16: Verification Brute-Force Protection
    // ------------------------------------------------------------------
    console.log("\n[TEST 16] Verification brute-force protection (max 5 attempts)...");
    const brutePhone = "+6289998887770";
    const bruteReq = await WhatsAppVerificationService.requestVerification(
      userAId,
      brutePhone,
      mockClient
    );

    // Fail 5 times
    for (let i = 0; i < 5; i++) {
      await WhatsAppVerificationService.verifyCode(userAId, brutePhone, "000000");
    }

    // 6th attempt even with correct code must now be blocked
    const bruteBlocked = await WhatsAppVerificationService.verifyCode(
      userAId,
      brutePhone,
      bruteReq.devCode!
    );
    assert(bruteBlocked.success === false, "Brute-forced challenge must be locked");
    assert(Boolean(bruteBlocked.error?.includes("Batas percobaan")), "Error message must indicate lockout");
    console.log("✓ PASS: Brute-force lockout enforced after 5 incorrect attempts");

    // ------------------------------------------------------------------
    // TEST 17: Rate Limiting Protection
    // ------------------------------------------------------------------
    console.log("\n[TEST 17] Rate limiting protection...");
    const rateLimitKey = "test_rate_limit_ip_1";
    // Threshold 3 requests in 1000ms
    const r1 = checkRateLimit(rateLimitKey, 3, 1000);
    const r2 = checkRateLimit(rateLimitKey, 3, 1000);
    const r3 = checkRateLimit(rateLimitKey, 3, 1000);
    const r4 = checkRateLimit(rateLimitKey, 3, 1000);

    assert(r1.allowed === true, "1st request allowed");
    assert(r2.allowed === true, "2nd request allowed");
    assert(r3.allowed === true, "3rd request allowed");
    assert(r4.allowed === false, "4th request blocked by rate limit");
    console.log("✓ PASS: Rate limiter blocks requests exceeding threshold");

    // ------------------------------------------------------------------
    // TEST 18: Outbound Timeout Handling
    // ------------------------------------------------------------------
    console.log("\n[TEST 18] Outbound client timeout...");
    const hangingFetch: typeof fetch = async (_url, init) => {
      return new Promise((_resolve, reject) => {
        const signal = init?.signal;
        if (signal) {
          signal.addEventListener("abort", () => {
            const err = new Error("This operation was aborted");
            err.name = "AbortError";
            reject(err);
          });
        }
      });
    };

    const timeoutClient = new WhatsAppClient(hangingFetch, 20); // 20ms timeout
    const timeoutRes = await timeoutClient.sendTextMessage({
      to: userAPhone,
      text: "Testing timeout",
    });
    assert(timeoutRes.success === false, "Timed out call must fail");
    assert(Boolean(timeoutRes.error?.includes("timed out")), "Error should mention timed out");
    assert(timeoutRes.isRetryable === true, "Timeout error must be classified as retryable");
    console.log("✓ PASS: Outbound client timeout classified as retryable");

    // ------------------------------------------------------------------
    // TEST 19: Retryable vs Non-Retryable Error Classification
    // ------------------------------------------------------------------
    console.log("\n[TEST 19] Error classification (retryable vs non-retryable)...");
    assert(WhatsAppClient.isRetryableError(500) === true, "500 is retryable");
    assert(WhatsAppClient.isRetryableError(429) === true, "429 is retryable");
    assert(WhatsAppClient.isRetryableError(503) === true, "503 is retryable");
    assert(WhatsAppClient.isRetryableError(400) === false, "400 is not retryable");
    assert(WhatsAppClient.isRetryableError(401) === false, "401 is not retryable");
    assert(WhatsAppClient.isRetryableError(403) === false, "403 is not retryable");
    console.log("✓ PASS: Status codes accurately classified for retry safety");

    // ------------------------------------------------------------------
    // TEST 20: Processing Status Lifecycle
    // ------------------------------------------------------------------
    console.log("\n[TEST 20] Message status lifecycle (RECEIVED -> PROCESSED)...");
    const statusMsgId = `wamid.STATUS_LIFECYCLE_${ts}`;
    const statusResult = await WhatsAppMessageService.processInboundMessage(
      {
        providerMessageId: statusMsgId,
        phoneNumber: userAPhone,
        normalizedPhoneNumber: userAPhone,
        messageType: "text",
        text: "Halo status lifecycle",
        receivedAt: new Date(),
      },
      mockClient
    );
    assert(statusResult.status === "PROCESSED", `Expected status PROCESSED, got ${statusResult.status}`);

    const [dbStatusMsg] = await db
      .select()
      .from(whatsappMessages)
      .where(eq(whatsappMessages.whatsappMessageId, statusMsgId));
    assert(dbStatusMsg.status === "PROCESSED", "DB status must be PROCESSED");
    assert(dbStatusMsg.receivedAt !== null, "receivedAt must be set");
    assert(dbStatusMsg.processedAt !== null, "processedAt must be set upon completion");
    console.log("✓ PASS: Lifecycle statuses accurately transition with reliable timestamps");

    // ------------------------------------------------------------------
    // TEST 21: Direct WhatsApp Message Verification Code
    // ------------------------------------------------------------------
    console.log("\n[TEST 21] Inbound WhatsApp message verification code...");
    const directWaPhone = "+6281122334455";
    const directWaChallenge = await WhatsAppVerificationService.requestVerification(
      userBId,
      directWaPhone,
      mockClient
    );

    // User replies with code via WhatsApp message e.g. "KODE 123456"
    const waVerifyMsgId = `wamid.WA_VERIFY_${ts}`;
    const waVerifyResult = await WhatsAppMessageService.processInboundMessage(
      {
        providerMessageId: waVerifyMsgId,
        phoneNumber: directWaPhone,
        normalizedPhoneNumber: directWaPhone,
        messageType: "text",
        text: `KODE ${directWaChallenge.devCode}`,
        receivedAt: new Date(),
      },
      mockClient
    );
    assert(waVerifyResult.status === "PROCESSED", "WhatsApp verification message must be PROCESSED");
    assert(Boolean(waVerifyResult.responseSent?.includes("berhasil diverifikasi")), "Reply should confirm verification");

    const [directVerifiedContact] = await db
      .select()
      .from(whatsappContacts)
      .where(eq(whatsappContacts.phoneNumber, directWaPhone));
    assert(directVerifiedContact.verifiedAt !== null, "Contact must now be verified");
    console.log("✓ PASS: WhatsApp message containing verification code successfully activates contact");

    console.log("\n====================================================");
    console.log("   ALL PHASE 4 HARDENING TESTS PASSED (21/21)       ");
    console.log("====================================================");
  } finally {
    console.log("\nCleaning up Phase 4 test data...");
    // Cleanup verification challenges
    await db
      .delete(whatsappVerificationChallenges)
      .where(inArray(whatsappVerificationChallenges.userId, [userAId, userBId]));
    // Cleanup whatsappMessages
    await db
      .delete(whatsappMessages)
      .where(
        inArray(whatsappMessages.userId, [userAId, userBId])
      );
    // Cleanup any orphaned test messages by phoneNumber
    await db
      .delete(whatsappMessages)
      .where(
        inArray(whatsappMessages.phoneNumber, [
          userAPhone,
          userBPhone,
          unlinkedPhone,
          "+6287778889990",
          "+6285556667770",
          "+6289998887770",
          "+6281122334455",
        ])
      );
    // Cleanup whatsappContacts
    await db
      .delete(whatsappContacts)
      .where(inArray(whatsappContacts.userId, [userAId, userBId]));
    // Cleanup users
    await db.delete(user).where(inArray(user.id, [userAId, userBId]));
    console.log("Cleanup completed.");
  }
}

runWhatsAppTests()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error("\n❌ PHASE 4 TEST RUN FAILED:\n", err);
    process.exit(1);
  });
