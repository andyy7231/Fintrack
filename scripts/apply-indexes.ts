import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());
import postgres from "postgres";

async function main() {
  const sql = postgres(process.env.DATABASE_URL || "", { ssl: "require", max: 1 });

  const indexes = [
    "CREATE INDEX IF NOT EXISTS idx_transactions_user_account_type_status ON transactions(user_id, account_id, type, status)",
    "CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON transactions(user_id, transaction_date DESC)",
    "CREATE INDEX IF NOT EXISTS idx_transactions_user_type_status ON transactions(user_id, type, status)",
    "CREATE INDEX IF NOT EXISTS idx_transfers_user_from_account ON transfers(user_id, from_account_id)",
    "CREATE INDEX IF NOT EXISTS idx_transfers_user_to_account ON transfers(user_id, to_account_id)",
    "CREATE INDEX IF NOT EXISTS idx_budgets_user_account_dates ON budgets(user_id, account_id, start_date, end_date)",
    "CREATE INDEX IF NOT EXISTS idx_accounts_user_active ON accounts(user_id, is_active)",
    "CREATE INDEX IF NOT EXISTS idx_categories_user_type ON categories(user_id, type)",
    "CREATE INDEX IF NOT EXISTS idx_goals_user ON financial_goals(user_id)",
    "CREATE INDEX IF NOT EXISTS idx_goal_contributions_user_goal ON goal_contributions(user_id, goal_id)",
  ];

  console.log("P7.5 - Applying Database Indexes...\n");

  let count = 0;
  for (const query of indexes) {
    try {
      await sql.unsafe(query);
      console.log(`? Index ${++count}/${indexes.length} created`);
    } catch (e: any) {
      if (e.message?.includes("already exists")) {
        console.log(`? Index ${++count}/${indexes.length} exists`);
      } else {
        console.error(`? Error:`, e.message);
      }
    }
  }

  console.log("\nAnalyzing tables...");
  const tables = ["transactions", "transfers", "accounts", "budgets", "categories", "financial_goals", "goal_contributions"];
  for (const t of tables) {
    await sql.unsafe(`ANALYZE ${t}`);
    console.log(`? Analyzed ${t}`);
  }

  console.log("\n? Database optimization complete!");
  console.log("Expected: 2-7s ? <1s query time\n");

  await sql.end();
}

main().catch(console.error);
