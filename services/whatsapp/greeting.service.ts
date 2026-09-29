import { db } from "@/lib/db";
import { user } from "@/db/schema";
import { eq } from "drizzle-orm";

export class GreetingService {
  /**
   * Check if text is a greeting, menu request, or help command
   */
  static isGreeting(rawText: string): boolean {
    const text = rawText.toLowerCase().trim();

    const greetingKeywords = [
      "halo",
      "halo bot",
      "halo fintrack",
      "hai",
      "hi",
      "hei",
      "hey",
      "selamat pagi",
      "selamat siang",
      "selamat sore",
      "selamat malam",
      "assalamualaikum",
      "p",
      "ping",
      "menu",
      "help",
      "bantuan",
      "start",
      "mulai",
      "info",
      "panduan",
    ];

    return greetingKeywords.includes(text) || /^halo\s+/i.test(text) || /^hai\s+/i.test(text);
  }

  /**
   * Return a warm, personalized greeting addressing the registered user by name
   */
  static async handleGreeting(userId: string): Promise<string> {
    const [userData] = await db
      .select({ name: user.name })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);

    const userName = userData?.name || "Kak";

    return (
      `Halo, *${userName}*! 👋\n` +
      `Selamat datang di asisten keuangan FinTrack.\n\n` +
      `Saya siap membantu mencatat dan mengelola keuangan Anda langsung lewat WhatsApp. Berikut beberapa perintah yang bisa Anda gunakan:\n\n` +
      `📝 *Catat Pengeluaran:*
• "Beli kopi 25rb"
• "Beli sayur 15k"
• "Beli bensin 30rb"
• "Beli paketan 50rb"

💰 *Catat Pemasukan / Gaji:*
• "Gaji masuk 10 juta"
• "Dapat freelance 2jt"

📊 *Alokasi Gaji Otomatis:*
• "Gaji 10jt bagi makan 40%, transport 20%, tabungan 40%"

🔍 *Cek Sisa Budget:*
• "Cek budget"
• "Budget makan tinggal berapa"

🗑️ *Hapus Transaksi:*
• "Hapus pengeluaran kopi 25rb"
• "Hapus transaksi terakhir"\n\n` +
      `Ketik transaksi atau pertanyaan Anda kapan saja, data akan langsung tersinkron ke dashboard web Anda! 🚀`
    );
  }
}
