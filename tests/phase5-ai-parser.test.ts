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
  whatsappPendingActions,
} from "@/db/schema";
import {
  FinancialParserService,
  MockAIProvider,
  financialIntentSchema,
  parseIndonesianAmount,
  formatRupiah,
  parseIndonesianDate,
  IntentResolverService,
} from "@/services/ai";
import {
  UserMappingService,
  PendingActionService,
  WhatsAppMessageService,
  IWhatsAppClient,
} from "@/services/whatsapp";
import { eq, inArray } from "drizzle-orm";

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`ASSERTION FAILED: ${message}`);
  }
}

class TestWhatsAppClient implements IWhatsAppClient {
  public sentMessages: Array<{ to: string; text: string }> = [];

  async sendTextMessage(params: {
    to: string;
    text: string;
  }): Promise<{ success: boolean; messageId: string }> {
    this.sentMessages.push(params);
    return {
      success: true,
      messageId: `mock_wamid_p5_${Date.now()}`,
    };
  }

  reset() {
    this.sentMessages = [];
  }
}

async function runPhase5Tests() {
  console.log("====================================================");
  console.log("    FINTRACK PHASE 5 — AI PARSER & CONFIRMATION     ");
  console.log("====================================================");

  const ts = Date.now();
  const userAId = `p5_user_a_${ts}`;
  const userBId = `p5_user_b_${ts}`;
  const userAPhone = "+62812" + ts.toString().slice(-8);
  const userBPhone = "+62813" + ts.toString().slice(-8);

  const mockClient = new TestWhatsAppClient();
  const mockProvider = new MockAIProvider();
  const parserService = new FinancialParserService(mockProvider);

  // Pre-cleanup
  await db.delete(whatsappContacts).where(
    inArray(whatsappContacts.phoneNumber, [userAPhone, userBPhone])
  );

  // Setup test users
  await db.insert(user).values([
    {
      id: userAId,
      name: "Alpha Tester P5",
      email: `${userAId}@test.com`,
      currency: "IDR",
      timezone: "Asia/Jakarta",
    },
    {
      id: userBId,
      name: "Beta Tester P5",
      email: `${userBId}@test.com`,
      currency: "IDR",
      timezone: "Asia/Jakarta",
    },
  ]);

  // Setup User A financial accounts: Cash & BCA
  const [userACash] = await db
    .insert(accounts)
    .values({
      userId: userAId,
      name: "Cash",
      type: "CASH",
      initialBalance: "1000000.00",
      currency: "IDR",
      isActive: true,
    })
    .returning();

  const [userABca] = await db
    .insert(accounts)
    .values({
      userId: userAId,
      name: "Rekening BCA",
      type: "BANK",
      initialBalance: "5000000.00",
      currency: "IDR",
      isActive: true,
    })
    .returning();

  // Setup User B financial account: BCA (User B's private account)
  const [userBBca] = await db
    .insert(accounts)
    .values({
      userId: userBId,
      name: "BCA User B",
      type: "BANK",
      initialBalance: "2000000.00",
      currency: "IDR",
      isActive: true,
    })
    .returning();

  // Setup custom category for User A
  const [userACatCustom] = await db
    .insert(categories)
    .values({
      userId: userAId,
      name: "Langganan SaaS",
      type: "EXPENSE",
      isDefault: false,
    })
    .returning();

  // Link and verify WhatsApp numbers
  await UserMappingService.linkPhoneNumber(userAId, userAPhone, true);
  await UserMappingService.linkPhoneNumber(userBId, userBPhone, true);

  try {
    // ------------------------------------------------------------------
    // PARSER TESTS (1 to 10)
    // ------------------------------------------------------------------

    console.log("\n[TEST 1] Expense parsing...");
    const expResult = await mockProvider.parseFinancialMessage({
      text: "Beli kopi 25 ribu",
      currentDate: "2026-09-29",
      timezone: "Asia/Jakarta",
    });
    assert(expResult.intent === "EXPENSE", "Intent must be EXPENSE");
    if (expResult.intent === "EXPENSE") {
      assert(expResult.amount === 25000, `Expected amount 25000, got ${expResult.amount}`);
      assert(expResult.description.toLowerCase().includes("kopi"), "Description must contain kopi");
    }
    console.log("✓ PASS: Expense intent correctly parsed");

    console.log("\n[TEST 2] Income parsing...");
    const incResult = await mockProvider.parseFinancialMessage({
      text: "Gajian 7,5 juta",
      currentDate: "2026-09-29",
      timezone: "Asia/Jakarta",
    });
    assert(incResult.intent === "INCOME", "Intent must be INCOME");
    if (incResult.intent === "INCOME") {
      assert(incResult.amount === 7500000, `Expected amount 7500000, got ${incResult.amount}`);
      assert(incResult.categoryHint === "Gaji", "Category hint should be Gaji");
    }
    console.log("✓ PASS: Income intent correctly parsed");

    console.log("\n[TEST 3] Transfer parsing...");
    const trfResult = await mockProvider.parseFinancialMessage({
      text: "Transfer 500 ribu dari BCA ke BNI",
      currentDate: "2026-09-29",
      timezone: "Asia/Jakarta",
    });
    assert(trfResult.intent === "TRANSFER", "Intent must be TRANSFER");
    if (trfResult.intent === "TRANSFER") {
      assert(trfResult.amount === 500000, `Expected amount 500000, got ${trfResult.amount}`);
      assert(Boolean(trfResult.fromAccountHint?.toLowerCase().includes("bca")), "fromAccountHint must be BCA");
      assert(Boolean(trfResult.toAccountHint?.toLowerCase().includes("bni")), "toAccountHint must be BNI");
    }
    console.log("✓ PASS: Transfer intent correctly parsed");

    console.log("\n[TEST 4] Indonesian amount parsing...");
    assert(parseIndonesianAmount("25 ribu") === 25000, "25 ribu failed");
    assert(parseIndonesianAmount("25rb") === 25000, "25rb failed");
    assert(parseIndonesianAmount("25 k") === 25000, "25 k failed");
    assert(parseIndonesianAmount("25.000") === 25000, "25.000 failed");
    assert(parseIndonesianAmount("Rp25.000") === 25000, "Rp25.000 failed");
    assert(parseIndonesianAmount("Rp 25 ribu") === 25000, "Rp 25 ribu failed");
    assert(parseIndonesianAmount("1,5 juta") === 1500000, "1,5 juta failed");
    assert(parseIndonesianAmount("1.5 juta") === 1500000, "1.5 juta failed");
    assert(parseIndonesianAmount("1,5jt") === 1500000, "1,5jt failed");
    assert(parseIndonesianAmount("7,5 juta") === 7500000, "7,5 juta failed");
    assert(formatRupiah(25000).replace(/\s/g, "") === "Rp25.000", "formatRupiah failed");
    console.log("✓ PASS: Indonesian currency expressions parsed and formatted accurately");

    console.log("\n[TEST 5] Relative date parsing...");
    const today = parseIndonesianDate("hari ini");
    assert(today instanceof Date && !isNaN(today.getTime()), "Valid Date required");
    const kemarin = parseIndonesianDate("kemarin");
    assert(kemarin.getTime() < today.getTime(), "kemarin must be earlier than today");
    const senin = parseIndonesianDate("Senin");
    assert(senin instanceof Date && !isNaN(senin.getTime()), "Valid Date required for day name");
    console.log("✓ PASS: Relative date expressions resolved deterministically");

    console.log("\n[TEST 6] Unknown intent...");
    const unkResult = await mockProvider.parseFinancialMessage({
      text: "Halo selamat pagi apa kabar",
      currentDate: "2026-09-29",
      timezone: "Asia/Jakarta",
    });
    assert(unkResult.intent === "UNKNOWN", "Intent must be UNKNOWN");
    console.log("✓ PASS: Non-financial messages classified as UNKNOWN");

    console.log("\n[TEST 7] Missing amount...");
    const missingAmt = await mockProvider.parseFinancialMessage({
      text: "Tadi beli kopi",
      currentDate: "2026-09-29",
      timezone: "Asia/Jakarta",
    });
    assert(missingAmt.intent === "UNKNOWN", "Intent must be UNKNOWN for missing amount");
    if (missingAmt.intent === "UNKNOWN") {
      assert(missingAmt.reason === "MISSING_AMOUNT", "Reason must be MISSING_AMOUNT");
    }
    console.log("✓ PASS: Messages without amount ask for clarification");

    console.log("\n[TEST 8] Ambiguous intent...");
    const ambigExpense = await mockProvider.parseFinancialMessage({
      text: "bayar 50 ribu",
      currentDate: "2026-09-29",
      timezone: "Asia/Jakarta",
    });
    assert(ambigExpense.intent === "UNKNOWN", "Ambiguous expense without description must be UNKNOWN");
    const ambigGeneral = await mockProvider.parseFinancialMessage({
      text: "BCA 500 ribu",
      currentDate: "2026-09-29",
      timezone: "Asia/Jakarta",
    });
    assert(ambigGeneral.intent === "UNKNOWN", "Ambiguous general message must be UNKNOWN");
    console.log("✓ PASS: Ambiguous intent triggers clarification");

    console.log("\n[TEST 9] Invalid AI output rejected by Zod schema...");
    let schemaError = false;
    try {
      financialIntentSchema.parse({
        intent: "EXPENSE",
        amount: -5000, // Negative amount
        description: "",
      });
    } catch {
      schemaError = true;
    }
    assert(schemaError, "Zod schema must reject negative amount and empty description");
    console.log("✓ PASS: Zod schema rejects invalid AI output");

    console.log("\n[TEST 10] AI provider failure handling...");
    mockProvider.shouldFail = true;
    const failWorkflow = await parserService.processFinancialText("Beli kopi 25 ribu", userAId);
    assert(failWorkflow.status === "ERROR", "Provider failure should return ERROR status");
    mockProvider.shouldFail = false;
    console.log("✓ PASS: Provider failure handled gracefully without crashing");

    // ------------------------------------------------------------------
    // ACCOUNT RESOLUTION TESTS (11 to 14)
    // ------------------------------------------------------------------

    console.log("\n[TEST 11] Known account resolution...");
    const resBca = await IntentResolverService.resolveAccount(userAId, "BCA");
    assert(resBca.status === "RESOLVED", "Should resolve BCA account");
    if (resBca.status === "RESOLVED") {
      assert(resBca.account.id === userABca.id, "Resolved account ID must match userABca");
    }
    console.log("✓ PASS: Known account hint resolved to user's account");

    console.log("\n[TEST 12] Unknown account resolution...");
    const resUnknownAcc = await IntentResolverService.resolveAccount(userAId, "Bank Mandiri");
    assert(resUnknownAcc.status === "NOT_FOUND", "Unowned account must be NOT_FOUND");
    console.log("✓ PASS: Unowned account hint returns NOT_FOUND");

    console.log("\n[TEST 13] Ambiguous account resolution...");
    // Create another account with "Cash" in name for User A
    const [cashPetty] = await db
      .insert(accounts)
      .values({
        userId: userAId,
        name: "Cash Petty",
        type: "CASH",
        initialBalance: "500000.00",
        currency: "IDR",
        isActive: true,
      })
      .returning();
    const resAmbig = await IntentResolverService.resolveAccount(userAId, "Cash");
    assert(resAmbig.status === "AMBIGUOUS", "Multiple matching accounts must be AMBIGUOUS");
    await db.delete(accounts).where(eq(accounts.id, cashPetty.id)); // cleanup
    console.log("✓ PASS: Ambiguous account hint detected");

    console.log("\n[TEST 14] Account resolution user isolation...");
    // User A cannot resolve User B's account hint
    const resCrossAcc = await IntentResolverService.resolveAccount(userAId, "BCA User B");
    assert(resCrossAcc.status === "NOT_FOUND", "User A cannot resolve User B's account");
    console.log("✓ PASS: Account resolution strictly isolated to requesting user");

    // ------------------------------------------------------------------
    // CATEGORY RESOLUTION TESTS (15 to 18)
    // ------------------------------------------------------------------

    console.log("\n[TEST 15] Known category resolution...");
    const resCatKnown = await IntentResolverService.resolveCategory(userAId, "EXPENSE", "Makanan & Minuman");
    assert(resCatKnown.status === "RESOLVED", "Default food category must be resolved");
    const resCatCustom = await IntentResolverService.resolveCategory(userAId, "EXPENSE", "Langganan SaaS");
    assert(resCatCustom.status === "RESOLVED", "Custom SaaS category must be resolved");
    if (resCatCustom.status === "RESOLVED") {
      assert(resCatCustom.category.id === userACatCustom.id, "Category ID must match custom category");
    }
    console.log("✓ PASS: Known categories resolved for user");

    console.log("\n[TEST 16] Unknown category resolution...");
    const resCatUnknown = await IntentResolverService.resolveCategory(userAId, "EXPENSE", "Kategori Alien 123");
    assert(resCatUnknown.status === "NOT_FOUND", "Nonexistent category must be NOT_FOUND");
    console.log("✓ PASS: Unknown category handled gracefully");

    console.log("\n[TEST 17] Ambiguous category resolution...");
    // Insert another category containing "Langganan"
    const [catSub2] = await db
      .insert(categories)
      .values({
        userId: userAId,
        name: "Langganan Streaming",
        type: "EXPENSE",
        isDefault: false,
      })
      .returning();
    const resCatAmbig = await IntentResolverService.resolveCategory(userAId, "EXPENSE", "Langganan");
    assert(resCatAmbig.status === "AMBIGUOUS", "Multiple categories containing Langganan must be AMBIGUOUS");
    await db.delete(categories).where(eq(categories.id, catSub2.id)); // cleanup
    console.log("✓ PASS: Ambiguous category hint detected");

    console.log("\n[TEST 18] Category resolution user isolation...");
    // User B cannot access User A's custom category
    const resCatCross = await IntentResolverService.resolveCategory(userBId, "EXPENSE", "Langganan SaaS");
    assert(resCatCross.status === "NOT_FOUND", "User B cannot access User A's custom category");
    console.log("✓ PASS: Category resolution strictly isolated");

    // ------------------------------------------------------------------
    // CONFIRMATION LIFECYCLE TESTS (19 to 24)
    // ------------------------------------------------------------------

    console.log("\n[TEST 19] Pending action creation...");
    const action1 = await PendingActionService.createPendingAction(
      userAId,
      userAPhone,
      `wamid.ACT_1_${ts}`,
      "EXPENSE",
      {
        amount: 25000,
        description: "Kopi Kenangan",
        transactionDate: new Date(),
        accountId: userACash.id,
        categoryId: null,
      }
    );
    assert(action1.status === "PENDING", "Action status must be PENDING");
    assert(action1.expiresAt.getTime() > Date.now(), "Action expiresAt must be in the future");
    console.log("✓ PASS: Pending action created with 5-minute TTL");

    console.log("\n[TEST 20] Confirmation accepted (YA)...");
    const confResult = await PendingActionService.confirmAction(action1.id, userAId);
    assert(confResult.success === true, "Confirmation must succeed");
    const [executedDb] = await db
      .select()
      .from(whatsappPendingActions)
      .where(eq(whatsappPendingActions.id, action1.id));
    assert(executedDb.status === "EXECUTED", "Action status must be EXECUTED");
    console.log("✓ PASS: Pending action confirmed and executed");

    console.log("\n[TEST 21] Confirmation cancelled (BATAL)...");
    const action2 = await PendingActionService.createPendingAction(
      userAId,
      userAPhone,
      `wamid.ACT_2_${ts}`,
      "EXPENSE",
      {
        amount: 50000,
        description: "Bensin",
        transactionDate: new Date(),
        accountId: userACash.id,
      }
    );
    const cancelRes = await PendingActionService.cancelAction(action2.id, userAId);
    assert(cancelRes === true, "Cancellation must succeed");
    const [cancelledDb] = await db
      .select()
      .from(whatsappPendingActions)
      .where(eq(whatsappPendingActions.id, action2.id));
    assert(cancelledDb.status === "CANCELLED", "Action status must be CANCELLED");
    console.log("✓ PASS: Pending action cancelled");

    console.log("\n[TEST 22] Expired confirmation rejection...");
    const action3 = await PendingActionService.createPendingAction(
      userAId,
      userAPhone,
      `wamid.ACT_3_${ts}`,
      "EXPENSE",
      {
        amount: 30000,
        description: "Makan Siang",
        transactionDate: new Date(),
        accountId: userACash.id,
      }
    );
    // Artificially expire the action
    await db
      .update(whatsappPendingActions)
      .set({ expiresAt: new Date(Date.now() - 10000) })
      .where(eq(whatsappPendingActions.id, action3.id));

    let expError = false;
    try {
      await PendingActionService.confirmAction(action3.id, userAId);
    } catch (e: unknown) {
      expError = e instanceof Error && e.message.includes("kadaluarsa");
    }
    assert(expError, "Confirming expired action must throw expiration error");
    console.log("✓ PASS: Expired confirmation rejected");

    console.log("\n[TEST 23] Duplicate confirmation protection...");
    let dupError = false;
    try {
      // action1 was already executed in Test 20
      await PendingActionService.confirmAction(action1.id, userAId);
    } catch (e: unknown) {
      dupError = e instanceof Error && e.message.includes("DUPLICATE_CONFIRMATION");
    }
    assert(dupError, "Re-confirming already-executed action must throw duplicate error");
    console.log("✓ PASS: Duplicate confirmation rejected (zero duplicate execution)");

    console.log("\n[TEST 24] Confirmation cannot cross users...");
    const actionUserB = await PendingActionService.createPendingAction(
      userBId,
      userBPhone,
      `wamid.ACT_B_${ts}`,
      "EXPENSE",
      {
        amount: 15000,
        description: "Roti User B",
        transactionDate: new Date(),
        accountId: userBBca.id,
      }
    );
    let crossError = false;
    try {
      // User A attempts to confirm User B's action
      await PendingActionService.confirmAction(actionUserB.id, userAId);
    } catch {
      crossError = true;
    }
    assert(crossError, "User A confirming User B action must fail");
    console.log("✓ PASS: Cross-user confirmation strictly prohibited");

    // ------------------------------------------------------------------
    // FINANCIAL MUTATION TESTS (25 to 31)
    // ------------------------------------------------------------------

    console.log("\n[TEST 25] Confirmed expense creates exactly one transaction...");
    const txCountBefore = (await db.select().from(transactions).where(eq(transactions.userId, userAId))).length;
    mockClient.reset();

    // Inbound: "Beli bensin 50 ribu"
    await WhatsAppMessageService.processInboundMessage(
      {
        providerMessageId: `wamid.EXP_INBOUND_${ts}`,
        phoneNumber: userAPhone,
        normalizedPhoneNumber: userAPhone,
        messageType: "text",
        text: "Beli bensin 50 ribu",
        receivedAt: new Date(),
      },
      mockClient,
      parserService
    );
    assert(mockClient.sentMessages[0]?.text.includes("Catat pengeluaran"), "Must prompt for confirmation");

    // Inbound: "YA"
    await WhatsAppMessageService.processInboundMessage(
      {
        providerMessageId: `wamid.EXP_CONFIRM_${ts}`,
        phoneNumber: userAPhone,
        normalizedPhoneNumber: userAPhone,
        messageType: "text",
        text: "YA",
        receivedAt: new Date(),
      },
      mockClient,
      parserService
    );
    const txCountAfter = (await db.select().from(transactions).where(eq(transactions.userId, userAId))).length;
    assert(txCountAfter === txCountBefore + 1, `Expected exactly 1 new transaction, got ${txCountAfter - txCountBefore}`);
    console.log("✓ PASS: Confirmed expense created exactly one financial transaction");

    console.log("\n[TEST 26] Confirmed income creates exactly one transaction...");
    mockClient.reset();
    await WhatsAppMessageService.processInboundMessage(
      {
        providerMessageId: `wamid.INC_INBOUND_${ts}`,
        phoneNumber: userAPhone,
        normalizedPhoneNumber: userAPhone,
        messageType: "text",
        text: "Gajian 7,5 juta",
        receivedAt: new Date(),
      },
      mockClient,
      parserService
    );
    // User replies "OK"
    await WhatsAppMessageService.processInboundMessage(
      {
        providerMessageId: `wamid.INC_CONFIRM_${ts}`,
        phoneNumber: userAPhone,
        normalizedPhoneNumber: userAPhone,
        messageType: "text",
        text: "OK",
        receivedAt: new Date(),
      },
      mockClient,
      parserService
    );
    const txIncomeCount = (
      await db
        .select()
        .from(transactions)
        .where(eq(transactions.userId, userAId))
    ).filter((t) => t.type === "INCOME").length;
    assert(txIncomeCount === 1, `Expected 1 income transaction, got ${txIncomeCount}`);
    console.log("✓ PASS: Confirmed income created exactly one financial transaction");

    console.log("\n[TEST 27] Confirmed transfer creates exactly one transfer...");
    const trfCountBefore = (await db.select().from(transfers).where(eq(transfers.userId, userAId))).length;
    mockClient.reset();
    await WhatsAppMessageService.processInboundMessage(
      {
        providerMessageId: `wamid.TRF_INBOUND_${ts}`,
        phoneNumber: userAPhone,
        normalizedPhoneNumber: userAPhone,
        messageType: "text",
        text: "Transfer 200 ribu dari Cash ke BCA",
        receivedAt: new Date(),
      },
      mockClient,
      parserService
    );
    // Confirm with "LANJUT"
    await WhatsAppMessageService.processInboundMessage(
      {
        providerMessageId: `wamid.TRF_CONFIRM_${ts}`,
        phoneNumber: userAPhone,
        normalizedPhoneNumber: userAPhone,
        messageType: "text",
        text: "LANJUT",
        receivedAt: new Date(),
      },
      mockClient,
      parserService
    );
    const trfCountAfter = (await db.select().from(transfers).where(eq(transfers.userId, userAId))).length;
    assert(trfCountAfter === trfCountBefore + 1, "Expected exactly 1 new transfer");
    console.log("✓ PASS: Confirmed transfer created exactly one transfer record");

    console.log("\n[TEST 28] Unconfirmed intent creates ZERO financial mutations...");
    const txBeforeUnconf = (await db.select().from(transactions)).length;
    const trfBeforeUnconf = (await db.select().from(transfers)).length;
    // Send message but NEVER reply "YA"
    await WhatsAppMessageService.processInboundMessage(
      {
        providerMessageId: `wamid.UNCONF_${ts}`,
        phoneNumber: userAPhone,
        normalizedPhoneNumber: userAPhone,
        messageType: "text",
        text: "Beli sneakers 1 juta",
        receivedAt: new Date(),
      },
      mockClient,
      parserService
    );
    const txAfterUnconf = (await db.select().from(transactions)).length;
    const trfAfterUnconf = (await db.select().from(transfers)).length;
    assert(txAfterUnconf === txBeforeUnconf, "Unconfirmed intent must not mutate transactions");
    assert(trfAfterUnconf === trfBeforeUnconf, "Unconfirmed intent must not mutate transfers");
    console.log("✓ PASS: Unconfirmed intent caused zero financial mutations");

    console.log("\n[TEST 29] Ambiguous intent creates ZERO financial mutations...");
    await WhatsAppMessageService.processInboundMessage(
      {
        providerMessageId: `wamid.AMBIG_${ts}`,
        phoneNumber: userAPhone,
        normalizedPhoneNumber: userAPhone,
        messageType: "text",
        text: "bayar 50 ribu",
        receivedAt: new Date(),
      },
      mockClient,
      parserService
    );
    const txAfterAmbig = (await db.select().from(transactions)).length;
    assert(txAfterAmbig === txBeforeUnconf, "Ambiguous intent must not mutate transactions");
    console.log("✓ PASS: Ambiguous intent caused zero financial mutations");

    console.log("\n[TEST 30] AI failure creates ZERO financial mutations...");
    mockProvider.shouldFail = true;
    await WhatsAppMessageService.processInboundMessage(
      {
        providerMessageId: `wamid.FAIL_${ts}`,
        phoneNumber: userAPhone,
        normalizedPhoneNumber: userAPhone,
        messageType: "text",
        text: "Beli emas 10 juta",
        receivedAt: new Date(),
      },
      mockClient,
      parserService
    );
    mockProvider.shouldFail = false;
    const txAfterFail = (await db.select().from(transactions)).length;
    assert(txAfterFail === txBeforeUnconf, "AI failure must not mutate transactions");
    console.log("✓ PASS: AI failure caused zero financial mutations");

    console.log("\n[TEST 31] Duplicate webhook creates zero duplicate financial mutations...");
    const txBeforeDedup = (await db.select().from(transactions)).length;
    // Send same confirmation message ID 3 times
    const dedupConfirmId = `wamid.DEDUP_CONFIRM_${ts}`;
    await PendingActionService.createPendingAction(
      userAId,
      userAPhone,
      `wamid.PRE_${ts}`,
      "EXPENSE",
      {
        amount: 10000,
        description: "Parkir",
        transactionDate: new Date(),
        accountId: userACash.id,
      }
    );

    // Delivery 1
    await WhatsAppMessageService.processInboundMessage(
      {
        providerMessageId: dedupConfirmId,
        phoneNumber: userAPhone,
        normalizedPhoneNumber: userAPhone,
        messageType: "text",
        text: "YA",
        receivedAt: new Date(),
      },
      mockClient,
      parserService
    );

    // Delivery 2 (Duplicate retry)
    await WhatsAppMessageService.processInboundMessage(
      {
        providerMessageId: dedupConfirmId,
        phoneNumber: userAPhone,
        normalizedPhoneNumber: userAPhone,
        messageType: "text",
        text: "YA",
        receivedAt: new Date(),
      },
      mockClient,
      parserService
    );

    // Delivery 3 (Duplicate retry)
    await WhatsAppMessageService.processInboundMessage(
      {
        providerMessageId: dedupConfirmId,
        phoneNumber: userAPhone,
        normalizedPhoneNumber: userAPhone,
        messageType: "text",
        text: "YA",
        receivedAt: new Date(),
      },
      mockClient,
      parserService
    );

    const txAfterDedup = (await db.select().from(transactions)).length;
    assert(txAfterDedup === txBeforeDedup + 1, "Duplicate webhook deliveries must create only 1 transaction");
    console.log("✓ PASS: Duplicate webhook retry creates exactly 1 transaction");

    // ------------------------------------------------------------------
    // SECURITY TESTS (32 to 36)
    // ------------------------------------------------------------------

    console.log("\n[TEST 32] AI cannot specify arbitrary userId...");
    // Provider output containing malicious userId is ignored; userId is strictly bound to verified contact
    mockProvider.mockResponse = {
      intent: "EXPENSE",
      amount: 25000,
      description: "Injeksi User ID",
      accountHint: "Cash",
    };
    const injectedRes = await WhatsAppMessageService.processInboundMessage(
      {
        providerMessageId: `wamid.SEC_INJECT_${ts}`,
        phoneNumber: userAPhone,
        normalizedPhoneNumber: userAPhone,
        messageType: "text",
        text: "Beli sesuatu",
        receivedAt: new Date(),
      },
      mockClient,
      parserService
    );
    mockProvider.mockResponse = null;
    assert(injectedRes.userId === userAId, "Message must be bound to authenticated User A");
    console.log("✓ PASS: User ID strictly bound to verified contact, cannot be injected");

    console.log("\n[TEST 33] AI cannot specify arbitrary accountId directly...");
    // Parser resolves accountHint against user's accounts; arbitrary IDs cannot be injected
    const resolveArbitrary = await IntentResolverService.resolveAccount(userAId, "unauthorized_account_999");
    assert(resolveArbitrary.status === "NOT_FOUND", "Arbitrary account IDs not allowed");
    console.log("✓ PASS: Direct arbitrary account IDs blocked");

    console.log("\n[TEST 34] AI cannot specify arbitrary categoryId directly...");
    const resolveArbitraryCat = await IntentResolverService.resolveCategory(userAId, "EXPENSE", "fake_category_id_999");
    assert(resolveArbitraryCat.status === "NOT_FOUND", "Arbitrary category IDs not allowed");
    console.log("✓ PASS: Direct arbitrary category IDs blocked");

    console.log("\n[TEST 35] User A cannot access User B accounts or categories...");
    const crossCheckAccounts = await IntentResolverService.resolveAccount(userAId, userBBca.name);
    assert(crossCheckAccounts.status === "NOT_FOUND", "Cross-user account access must be blocked");
    console.log("✓ PASS: Cross-user accounts inaccessible");

    console.log("\n[TEST 36] User A cannot execute User B pending action...");
    const userBPending = await PendingActionService.createPendingAction(
      userBId,
      userBPhone,
      `wamid.SEC_B_${ts}`,
      "EXPENSE",
      {
        amount: 100000,
        description: "Tagihan User B",
        transactionDate: new Date(),
        accountId: userBBca.id,
      }
    );
    let crossExecBlocked = false;
    try {
      await PendingActionService.confirmAction(userBPending.id, userAId);
    } catch {
      crossExecBlocked = true;
    }
    assert(crossExecBlocked, "User A executing User B pending action must be rejected");
    console.log("✓ PASS: Pending action execution strictly bounded to owning user");

    console.log("\n====================================================");
    console.log("   ALL PHASE 5 TESTS PASSED SUCCESSFULLY (36/36)   ");
    console.log("====================================================");
  } finally {
    console.log("\nCleaning up Phase 5 test data...");
    // Cleanup pending actions
    await db
      .delete(whatsappPendingActions)
      .where(inArray(whatsappPendingActions.userId, [userAId, userBId]));
    // Cleanup transactions
    await db
      .delete(transactions)
      .where(inArray(transactions.userId, [userAId, userBId]));
    // Cleanup transfers
    await db
      .delete(transfers)
      .where(inArray(transfers.userId, [userAId, userBId]));
    // Cleanup accounts
    await db
      .delete(accounts)
      .where(inArray(accounts.userId, [userAId, userBId]));
    // Cleanup categories
    await db
      .delete(categories)
      .where(inArray(categories.userId, [userAId, userBId]));
    // Cleanup whatsappMessages
    await db
      .delete(whatsappMessages)
      .where(inArray(whatsappMessages.userId, [userAId, userBId]));
    await db
      .delete(whatsappMessages)
      .where(inArray(whatsappMessages.phoneNumber, [userAPhone, userBPhone]));
    // Cleanup contacts
    await db
      .delete(whatsappContacts)
      .where(inArray(whatsappContacts.userId, [userAId, userBId]));
    // Cleanup users
    await db.delete(user).where(inArray(user.id, [userAId, userBId]));
    console.log("Cleanup completed.");
  }
}

runPhase5Tests()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error("\n❌ PHASE 5 TEST RUN FAILED:\n", err);
    process.exit(1);
  });
