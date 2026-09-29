import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { db } from "@/lib/db";
import {
  user,
  accounts,
  categories,
  budgets,
  transactions,
  transfers,
  whatsappContacts,
  whatsappMessages,
  whatsappPendingActions,
} from "@/db/schema";
import {
  FinancialParserService,
  MockAIProvider,
  IntentResolverService,
  isBalanceQuery,
} from "@/services/ai";
import {
  UserMappingService,
  PendingActionService,
  WhatsAppMessageService,
  IWhatsAppClient,
} from "@/services/whatsapp";
import { AccountService } from "@/services/account.service";
import { eq, inArray, and } from "drizzle-orm";

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
      messageId: `mock_wamid_p52_${Date.now()}`,
    };
  }

  reset() {
    this.sentMessages = [];
  }
}

async function runPhase52Tests() {
  console.log("====================================================");
  console.log(" FINTRACK PHASE 5.2 — BUDGET ALLOC & BALANCE QUERY  ");
  console.log("====================================================");

  const ts = Date.now();
  const userAId = `p52_user_a_${ts}`;
  const userBId = `p52_user_b_${ts}`;
  const userAPhone = "+62818" + ts.toString().slice(-8);
  const userBPhone = "+62819" + ts.toString().slice(-8);

  const mockClient = new TestWhatsAppClient();
  const mockProvider = new MockAIProvider();
  const parserService = new FinancialParserService(mockProvider);

  // Pre-cleanup
  await db
    .delete(whatsappContacts)
    .where(inArray(whatsappContacts.phoneNumber, [userAPhone, userBPhone]));

  // Setup test users
  await db.insert(user).values([
    {
      id: userAId,
      name: "Alpha P52",
      email: `${userAId}@test.com`,
      currency: "IDR",
      timezone: "Asia/Jakarta",
    },
    {
      id: userBId,
      name: "Beta P52",
      email: `${userBId}@test.com`,
      currency: "IDR",
      timezone: "Asia/Jakarta",
    },
  ]);

  // Setup User A financial accounts:
  // Kas: 500.000, BCA: 2.000.000, Dana: 750.000 (Total = 3.250.000)
  const [userAKas] = await db
    .insert(accounts)
    .values({
      userId: userAId,
      name: "Kas",
      type: "CASH",
      currency: "IDR",
      initialBalance: "500000.00",
      isActive: true,
    })
    .returning();

  const [userABca] = await db
    .insert(accounts)
    .values({
      userId: userAId,
      name: "BCA",
      type: "BANK",
      currency: "IDR",
      initialBalance: "2000000.00",
      isActive: true,
    })
    .returning();

  await db
    .insert(accounts)
    .values({
      userId: userAId,
      name: "Dana",
      type: "E_WALLET",
      currency: "IDR",
      initialBalance: "750000.00",
      isActive: true,
    });

  // Setup User B account (for IDOR isolation testing)
  await db
    .insert(accounts)
    .values({
      userId: userBId,
      name: "BCA User B",
      type: "BANK",
      currency: "IDR",
      initialBalance: "50000000.00",
      isActive: true,
    });

  // User A Categories
  const [catMakan] = await db
    .insert(categories)
    .values({
      userId: userAId,
      name: "Makanan & Minuman",
      type: "EXPENSE",
      icon: "🍔",
      isDefault: false,
    })
    .returning();

  await db
    .insert(categories)
    .values({
      userId: userAId,
      name: "Kos",
      type: "EXPENSE",
      icon: "🏠",
      isDefault: false,
    });

  await db
    .insert(categories)
    .values({
      userId: userAId,
      name: "Transportasi",
      type: "EXPENSE",
      icon: "🚗",
      isDefault: false,
    });

  await db
    .insert(categories)
    .values({
      userId: userAId,
      name: "Gaji",
      type: "INCOME",
      icon: "💵",
      isDefault: false,
    });

  // User B Private Category (for IDOR category testing)
  const [catUserBPrivate] = await db
    .insert(categories)
    .values({
      userId: userBId,
      name: "Rahasia User B",
      type: "EXPENSE",
      icon: "🔒",
      isDefault: false,
    })
    .returning();

  // Register verified WhatsApp Contacts
  await UserMappingService.linkPhoneNumber(userAId, userAPhone, true);
  await UserMappingService.linkPhoneNumber(userBId, userBPhone, true);

  try {
    // ==================================================================
    // PART A: BUDGET ALLOCATION TESTS (1 to 8)
    // ==================================================================

    console.log("\n[TEST 1] Income + multiple budget allocations...");
    mockProvider.mockResponse = {
      actions: [
        {
          intent: "INCOME",
          amount: 5000000,
          description: "Gaji",
          transactionDate: "2026-09-29",
          accountHint: "Kas",
          categoryHint: "Gaji",
          confidence: 0.95,
        },
        {
          intent: "BUDGET_ALLOCATION",
          amount: 1000000,
          categoryName: "makan",
          confidence: 0.95,
        },
        {
          intent: "BUDGET_ALLOCATION",
          amount: 500000,
          categoryName: "transport",
          confidence: 0.95,
        },
      ],
    };

    const parsed1 = await parserService.processFinancialText(
      "Gaji 5jt, budget makan 1jt, budget transport 500rb",
      userAId
    );
    mockProvider.mockResponse = null;

    assert(parsed1.status === "READY_FOR_CONFIRMATION", "Expected READY_FOR_CONFIRMATION status");
    if (parsed1.status === "READY_FOR_CONFIRMATION") {
      assert(parsed1.actionCount === 3, `Expected 3 actions, got ${parsed1.actionCount}`);
      assert(parsed1.actions[0]?.intentType === "INCOME", "Item 1 should be INCOME");
      assert(parsed1.actions[1]?.intentType === "BUDGET_ALLOCATION", "Item 2 should be BUDGET_ALLOCATION");
      assert(parsed1.actions[2]?.intentType === "BUDGET_ALLOCATION", "Item 3 should be BUDGET_ALLOCATION");
    }
    console.log("✓ PASS: Income + multiple budget allocations parsed correctly");

    console.log("\n[TEST 2] Income + budget + multiple expenses (Master Prompt example)...");
    const multiLineMessage =
      "Gaji 2.25 juta dibagi untuk:\n" +
      "budget makan 600k\n" +
      "budget kos 750k\n" +
      "bayar kurangan seragam 100k\n" +
      "biaya atribut 100k\n" +
      "bayar paylater 50k";

    // Test with MockAIProvider deterministic multi-line parser
    const parsed2 = await parserService.processFinancialText(multiLineMessage, userAId);
    assert(parsed2.status === "READY_FOR_CONFIRMATION", "Expected READY_FOR_CONFIRMATION");
    if (parsed2.status === "READY_FOR_CONFIRMATION") {
      assert(parsed2.actionCount === 6, `Expected 6 actions, got ${parsed2.actionCount}`);
      assert(parsed2.actions[0]?.intentType === "INCOME", "Action 0 should be INCOME");
      assert(parsed2.actions[0]?.amount === 2250000, "INCOME should be 2.250.000");
      assert(parsed2.actions[1]?.intentType === "BUDGET_ALLOCATION", "Action 1 should be BUDGET_ALLOCATION");
      assert(parsed2.actions[1]?.amount === 600000, "BUDGET 1 should be 600.000");
      assert(parsed2.actions[2]?.intentType === "BUDGET_ALLOCATION", "Action 2 should be BUDGET_ALLOCATION");
      assert(parsed2.actions[2]?.amount === 750000, "BUDGET 2 should be 750.000");
      assert(parsed2.actions[3]?.intentType === "EXPENSE", "Action 3 should be EXPENSE");
      assert(parsed2.actions[3]?.amount === 100000, "EXPENSE 1 should be 100.000");
      assert(parsed2.actions[4]?.intentType === "EXPENSE", "Action 4 should be EXPENSE");
      assert(parsed2.actions[4]?.amount === 100000, "EXPENSE 2 should be 100.000");
      assert(parsed2.actions[5]?.intentType === "EXPENSE", "Action 5 should be EXPENSE");
      assert(parsed2.actions[5]?.amount === 50000, "EXPENSE 3 should be 50.000");
    }
    console.log("✓ PASS: Complex 6-action message with budget & expenses parsed correctly");

    console.log("\n[TEST 3] 2+ budget allocations in one message...");
    const parsed3 = await parserService.processFinancialText(
      "budget makan 500k\nbudget transport 300k",
      userAId
    );
    assert(parsed3.status === "READY_FOR_CONFIRMATION", "Expected READY_FOR_CONFIRMATION");
    if (parsed3.status === "READY_FOR_CONFIRMATION") {
      assert(parsed3.actionCount === 2, "Expected 2 budget actions");
      assert(parsed3.actions[0]?.intentType === "BUDGET_ALLOCATION", "Action 0 should be budget");
      assert(parsed3.actions[1]?.intentType === "BUDGET_ALLOCATION", "Action 1 should be budget");
    }
    console.log("✓ PASS: 2+ budget allocations in one message parsed correctly");

    console.log("\n[TEST 4] Every budget appears as a distinct separate action...");
    if (parsed3.status === "READY_FOR_CONFIRMATION") {
      assert(
        parsed3.actions[0]?.budgetCategoryId !== parsed3.actions[1]?.budgetCategoryId,
        "Budget categories must be distinct"
      );
      assert(parsed3.actions[0]?.amount === 500000, "Action 0 amount 500k");
      assert(parsed3.actions[1]?.amount === 300000, "Action 1 amount 300k");
    }
    console.log("✓ PASS: Separate distinct budget actions verified");

    console.log("\n[TEST 5] Budget allocation creates budget record, NOT transaction record...");
    const txBeforeBgt = (await db.select().from(transactions).where(eq(transactions.userId, userAId))).length;
    const bgtBefore = (await db.select().from(budgets).where(eq(budgets.userId, userAId))).length;

    // Create pending action for budget makan 400k and confirm it
    const pendingBgt = await PendingActionService.createPendingAction(
      userAId,
      userAPhone,
      `wamid.BGT_ONLY_${ts}`,
      [
        {
          intentType: "BUDGET_ALLOCATION",
          amount: 400000,
          description: "Budget Makanan & Minuman",
          transactionDate: new Date(),
          budgetCategoryId: catMakan!.id,
        },
      ]
    );

    await PendingActionService.confirmAction(pendingBgt.id, userAId);

    const txAfterBgt = (await db.select().from(transactions).where(eq(transactions.userId, userAId))).length;
    const bgtAfter = (await db.select().from(budgets).where(eq(budgets.userId, userAId))).length;

    assert(txAfterBgt === txBeforeBgt, "Budget allocation must NOT create a transaction record");
    assert(bgtAfter === bgtBefore + 1, "Budget allocation must create a budget record");
    console.log("✓ PASS: Budget allocation creates budget, zero transactions");

    console.log("\n[TEST 6] All actions appear in confirmation prompt...");
    if (parsed2.status === "READY_FOR_CONFIRMATION") {
      assert(parsed2.confirmationPrompt.includes("6 tindakan"), "Prompt mentions 6 tindakan");
      assert(parsed2.confirmationPrompt.includes("Budget Makanan & Minuman"), "Prompt mentions Makan");
      assert(parsed2.confirmationPrompt.includes("Budget Kos"), "Prompt mentions Kos");
      assert(parsed2.confirmationPrompt.includes("kurangan seragam"), "Prompt mentions seragam");
      assert(parsed2.confirmationPrompt.includes("atribut"), "Prompt mentions atribut");
      assert(parsed2.confirmationPrompt.includes("paylater"), "Prompt mentions paylater");
      assert(parsed2.confirmationPrompt.includes("Balas *YA*"), "Prompt includes confirmation instructions");
    }
    console.log("✓ PASS: All actions visible in confirmation prompt");

    console.log("\n[TEST 7] Atomic rollback if financial action in batch fails...");
    const txBeforeFail = (await db.select().from(transactions).where(eq(transactions.userId, userAId))).length;
    let rollbackThrew = false;

    // Create a pending action with a valid expense and an invalid one (missing accountId)
    const invalidPending = await PendingActionService.createPendingAction(
      userAId,
      userAPhone,
      `wamid.FAIL_BATCH_${ts}`,
      [
        {
          intentType: "EXPENSE",
          amount: 50000,
          description: "Expense Valid",
          transactionDate: new Date(),
          accountId: userAKas!.id,
        },
        {
          intentType: "EXPENSE",
          amount: 75000,
          description: "Expense Invalid Missing Account",
          transactionDate: new Date(),
          // accountId missing on purpose
        },
      ]
    );

    try {
      await PendingActionService.confirmAction(invalidPending.id, userAId);
    } catch {
      rollbackThrew = true;
    }

    const txAfterFail = (await db.select().from(transactions).where(eq(transactions.userId, userAId))).length;
    assert(rollbackThrew, "Batch confirm must throw on invalid item");
    assert(txAfterFail === txBeforeFail, "Atomic rollback: Valid expense must NOT be committed if batch fails");
    console.log("✓ PASS: Atomic rollback verified when an action in batch fails");

    console.log("\n[TEST 8] Category resolution is strictly user-scoped (no cross-user budget)...");
    const crossCatRes = await IntentResolverService.resolveBudgetCategory(
      userAId,
      catUserBPrivate!.name
    );
    assert(crossCatRes.status === "NOT_FOUND", "User A must not resolve User B's private category");
    console.log("✓ PASS: Budget category resolution is strictly user-scoped");

    // ==================================================================
    // PART B: BALANCE QUERY TESTS (9 to 19)
    // ==================================================================

    console.log("\n[TEST 9] 'berapa sisa uang saya' recognized as BALANCE_QUERY...");
    assert(isBalanceQuery("berapa sisa uang saya"), "Must recognize 'berapa sisa uang saya'");
    const res9 = await parserService.processFinancialText("berapa sisa uang saya", userAId);
    assert(res9.status === "BALANCE_QUERY", "Parser returns BALANCE_QUERY");
    console.log("✓ PASS: 'berapa sisa uang saya' -> BALANCE_QUERY");

    console.log("\n[TEST 10] 'saldo saya berapa' recognized as BALANCE_QUERY...");
    assert(isBalanceQuery("saldo saya berapa"), "Must recognize 'saldo saya berapa'");
    const res10 = await parserService.processFinancialText("saldo saya berapa", userAId);
    assert(res10.status === "BALANCE_QUERY", "Parser returns BALANCE_QUERY");
    console.log("✓ PASS: 'saldo saya berapa' -> BALANCE_QUERY");

    console.log("\n[TEST 11] 'uang saya tinggal berapa' recognized as BALANCE_QUERY...");
    assert(isBalanceQuery("uang saya tinggal berapa"), "Must recognize 'uang saya tinggal berapa'");
    const res11 = await parserService.processFinancialText("uang saya tinggal berapa", userAId);
    assert(res11.status === "BALANCE_QUERY", "Parser returns BALANCE_QUERY");
    console.log("✓ PASS: 'uang saya tinggal berapa' -> BALANCE_QUERY");

    console.log("\n[TEST 12] Total balance calculated correctly from financial core...");
    // Current balances: Kas=500.000, BCA=2.000.000, Dana=750.000 -> Total = 3.250.000
    const accountsWithBal = await AccountService.getAccountsWithBalances(userAId);
    const totalBal = accountsWithBal.reduce((s, a) => s + a.currentBalance, 0);
    assert(totalBal === 3250000, `Expected total balance 3.250.000, got ${totalBal}`);

    if (res9.status === "BALANCE_QUERY") {
      assert(res9.responseText.includes("3.250.000"), "Response text must include Rp3.250.000");
    }
    console.log("✓ PASS: Total balance calculated accurately (Rp3.250.000)");

    console.log("\n[TEST 13] Account-specific balance query ('saldo BCA saya')...");
    const resBca = await parserService.processFinancialText("saldo BCA saya berapa", userAId);
    assert(resBca.status === "BALANCE_QUERY", "Expected BALANCE_QUERY");
    if (resBca.status === "BALANCE_QUERY") {
      assert(resBca.responseText.includes("BCA"), "Response must mention BCA");
      assert(resBca.responseText.includes("2.000.000"), "Response must show BCA balance Rp2.000.000");
      assert(!resBca.responseText.includes("Dana"), "Response must NOT include Dana");
    }
    console.log("✓ PASS: Account-specific balance query returns only target account");

    console.log("\n[TEST 14] Multiple account breakdown in total balance query...");
    if (res9.status === "BALANCE_QUERY") {
      assert(res9.responseText.includes("Kas:"), "Breakdown includes Kas");
      assert(res9.responseText.includes("BCA:"), "Breakdown includes BCA");
      assert(res9.responseText.includes("Dana:"), "Breakdown includes Dana");
    }
    console.log("✓ PASS: Total balance query includes breakdown of all active accounts");

    console.log("\n[TEST 15] Transfer affects account balances accurately in balance query...");
    // Transfer 500.000 from BCA to Kas
    await db.insert(transfers).values({
      userId: userAId,
      fromAccountId: userABca!.id,
      toAccountId: userAKas!.id,
      amount: "500000.00",
      description: "Pindah dana Kas",
      transferDate: new Date(),
    });

    const resTransferBal = await parserService.processFinancialText("berapa sisa uang saya", userAId);
    if (resTransferBal.status === "BALANCE_QUERY") {
      // Total remains 3.250.000
      assert(resTransferBal.responseText.includes("3.250.000"), "Total remains 3.250.000 after internal transfer");
      // Kas becomes 1.000.000
      assert(resTransferBal.responseText.includes("1.000.000"), "Kas updated to 1.000.000");
      // BCA becomes 1.500.000
      assert(resTransferBal.responseText.includes("1.500.000"), "BCA updated to 1.500.000");
    }
    console.log("✓ PASS: Transfer reflected accurately in balance query breakdown");

    console.log("\n[TEST 16] User isolation / IDOR in balance query...");
    const resUserBBal = await parserService.processFinancialText("berapa sisa uang saya", userBId);
    if (resUserBBal.status === "BALANCE_QUERY") {
      assert(resUserBBal.responseText.includes("50.000.000"), "User B sees 50.000.000");
      assert(!resUserBBal.responseText.includes("3.250.000"), "User B must NOT see User A's total");
      assert(!resUserBBal.responseText.includes("Dana"), "User B must NOT see User A's Dana account");
    }
    console.log("✓ PASS: User balance isolation strictly preserved");

    console.log("\n[TEST 17] BALANCE_QUERY creates ZERO transactions...");
    const txBeforeBQ = (await db.select().from(transactions).where(eq(transactions.userId, userAId))).length;
    mockClient.reset();

    await WhatsAppMessageService.processInboundMessage(
      {
        providerMessageId: `wamid.BQ_TX_${ts}`,
        phoneNumber: userAPhone,
        normalizedPhoneNumber: userAPhone,
        messageType: "text",
        text: "berapa sisa uang saya?",
        receivedAt: new Date(),
      },
      mockClient,
      parserService
    );

    const txAfterBQ = (await db.select().from(transactions).where(eq(transactions.userId, userAId))).length;
    assert(txAfterBQ === txBeforeBQ, "BALANCE_QUERY must create ZERO transactions");
    console.log("✓ PASS: BALANCE_QUERY creates 0 transactions");

    console.log("\n[TEST 18] BALANCE_QUERY creates ZERO pending actions...");
    const pendingActions = await db
      .select()
      .from(whatsappPendingActions)
      .where(
        and(
          eq(whatsappPendingActions.userId, userAId),
          eq(whatsappPendingActions.status, "PENDING")
        )
      );
    assert(pendingActions.length === 0, "BALANCE_QUERY must create ZERO pending actions");
    console.log("✓ PASS: BALANCE_QUERY creates 0 pending actions");

    console.log("\n[TEST 19] BALANCE_QUERY does NOT require YA / BATAL confirmation...");
    const waReply = mockClient.sentMessages[mockClient.sentMessages.length - 1]?.text || "";
    assert(waReply.includes("3.250.000"), "Outbound WA reply must contain balance directly");
    assert(!waReply.includes("Balas *YA*"), "Reply must NOT ask for confirmation");
    assert(!waReply.includes("BATAL"), "Reply must NOT mention BATAL");
    console.log("✓ PASS: Direct answer sent immediately without confirmation requirement");

    // ==================================================================
    // PART C: REGRESSION TESTS (20 to 24)
    // ==================================================================

    console.log("\n[TEST 20] Existing single expense still works...");
    mockClient.reset();
    await WhatsAppMessageService.processInboundMessage(
      {
        providerMessageId: `wamid.REG_EXP_${ts}`,
        phoneNumber: userAPhone,
        normalizedPhoneNumber: userAPhone,
        messageType: "text",
        text: "Beli kopi 25k",
        receivedAt: new Date(),
      },
      mockClient,
      parserService
    );
    const expReply = mockClient.sentMessages[mockClient.sentMessages.length - 1]?.text || "";
    assert(expReply.includes("25.000"), "Single expense asks for confirmation with 25.000");
    console.log("✓ PASS: Single expense flow intact");

    console.log("\n[TEST 21] Existing income still works...");
    mockClient.reset();
    await WhatsAppMessageService.processInboundMessage(
      {
        providerMessageId: `wamid.REG_INC_${ts}`,
        phoneNumber: userAPhone,
        normalizedPhoneNumber: userAPhone,
        messageType: "text",
        text: "Gaji 10 juta",
        receivedAt: new Date(),
      },
      mockClient,
      parserService
    );
    const incReply = mockClient.sentMessages[mockClient.sentMessages.length - 1]?.text || "";
    assert(incReply.includes("10.000.000"), "Income asks for confirmation with 10.000.000");
    console.log("✓ PASS: Single income flow intact");

    console.log("\n[TEST 22] Existing transfer still works...");
    mockClient.reset();
    await WhatsAppMessageService.processInboundMessage(
      {
        providerMessageId: `wamid.REG_TRF_${ts}`,
        phoneNumber: userAPhone,
        normalizedPhoneNumber: userAPhone,
        messageType: "text",
        text: "Transfer 50k dari BCA ke Dana",
        receivedAt: new Date(),
      },
      mockClient,
      parserService
    );
    const trfReply = mockClient.sentMessages[mockClient.sentMessages.length - 1]?.text || "";
    assert(trfReply.includes("50.000"), "Transfer asks for confirmation with 50.000");
    console.log("✓ PASS: Transfer flow intact");

    console.log("\n[TEST 23] Existing multi-action expense still works...");
    mockClient.reset();
    mockProvider.mockResponse = {
      actions: [
        {
          intent: "EXPENSE",
          amount: 25000,
          description: "Kopi",
          transactionDate: "2026-09-29",
          accountHint: "Kas",
          confidence: 0.95,
        },
        {
          intent: "EXPENSE",
          amount: 50000,
          description: "Bensin",
          transactionDate: "2026-09-29",
          accountHint: "Kas",
          confidence: 0.95,
        },
      ],
    };

    await WhatsAppMessageService.processInboundMessage(
      {
        providerMessageId: `wamid.REG_MULTI_${ts}`,
        phoneNumber: userAPhone,
        normalizedPhoneNumber: userAPhone,
        messageType: "text",
        text: "beli kopi 25k sama bensin 50rb",
        receivedAt: new Date(),
      },
      mockClient,
      parserService
    );
    mockProvider.mockResponse = null;

    const multiReply = mockClient.sentMessages[mockClient.sentMessages.length - 1]?.text || "";
    assert(multiReply.includes("2 tindakan"), "Multi-expense prompt mentions 2 tindakan");
    console.log("✓ PASS: Multi-action expense batch flow intact");

    console.log("\n[TEST 24] Budget query distinction check ('budget makan tinggal berapa')...");
    mockClient.reset();
    await WhatsAppMessageService.processInboundMessage(
      {
        providerMessageId: `wamid.BGT_CHECK_${ts}`,
        phoneNumber: userAPhone,
        normalizedPhoneNumber: userAPhone,
        messageType: "text",
        text: "budget makan tinggal berapa",
        receivedAt: new Date(),
      },
      mockClient,
      parserService
    );
    const bgtCheckReply = mockClient.sentMessages[mockClient.sentMessages.length - 1]?.text || "";
    assert(
      bgtCheckReply.includes("Budget") || bgtCheckReply.includes("Makanan & Minuman"),
      "Budget query asks BudgetQueryService, not balance query"
    );
    console.log("✓ PASS: Budget query correctly differentiated from balance query");

    console.log("\n====================================================");
    console.log("  ALL PHASE 5.2 TESTS PASSED SUCCESSFULLY (24/24)  ");
    console.log("====================================================");
  } finally {
    console.log("\nCleaning up Phase 5.2 test data...");
    await db
      .delete(whatsappPendingActions)
      .where(inArray(whatsappPendingActions.userId, [userAId, userBId]));
    await db
      .delete(transactions)
      .where(inArray(transactions.userId, [userAId, userBId]));
    await db
      .delete(transfers)
      .where(inArray(transfers.userId, [userAId, userBId]));
    await db
      .delete(budgets)
      .where(inArray(budgets.userId, [userAId, userBId]));
    await db
      .delete(accounts)
      .where(inArray(accounts.userId, [userAId, userBId]));
    await db
      .delete(categories)
      .where(inArray(categories.userId, [userAId, userBId]));
    await db
      .delete(whatsappMessages)
      .where(inArray(whatsappMessages.userId, [userAId, userBId]));
    await db
      .delete(whatsappMessages)
      .where(inArray(whatsappMessages.phoneNumber, [userAPhone, userBPhone]));
    await db
      .delete(whatsappContacts)
      .where(inArray(whatsappContacts.userId, [userAId, userBId]));
    await db.delete(user).where(inArray(user.id, [userAId, userBId]));
    console.log("✓ Cleanup complete.");
  }
}

runPhase52Tests().catch((err) => {
  console.error("\n💥 PHASE 5.2 TEST SUITE FAILED:", err);
  process.exit(1);
});
