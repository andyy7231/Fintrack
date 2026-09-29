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
      "tutorial",
    ];

    return greetingKeywords.includes(text) || /^halo\s+/i.test(text) || /^hai\s+/i.test(text);
  }

  /**
   * Return a warm, personalized greeting with mini tutorial
   */
  static async handleGreeting(userId: string): Promise<string> {
    const [userData] = await db
      .select({ name: user.name })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);

    const userName = userData?.name || "Kak";

    return (
      `👋 Halo, *${userName}*!\n` +
      `Selamat datang di *FinTrack* - Asisten Keuangan WhatsApp Anda! 💰\n\n` +
      `━━━━━━━━━━━━━━━━━━\n` +
      `🚀 *QUICK START TUTORIAL*\n` +
      `━━━━━━━━━━━━━━━━━━\n\n` +
      
      `*📝 1. CATAT PENGELUARAN*\n` +
      `Cukup ketik seperti ini:\n` +
      `• _Beli kopi 25rb_\n` +
      `• _Makan siang 50k_\n` +
      `• _Bensin motor 30rb_\n\n` +
      
      `*💰 2. CATAT PEMASUKAN*\n` +
      `• _Gaji masuk 10 juta_\n` +
      `• _Dapat freelance 2jt_\n\n` +
      
      `*🎯 3. BUAT BUDGET*\n` +
      `• _Budget makan 1jt_\n` +
      `• _Budget transport 500k_\n` +
      `• _Budget nabung 2jt_\n\n` +
      
      `*📊 4. CEK SALDO & BUDGET*\n` +
      `• _Cek saldo_\n` +
      `• _Uang free saya berapa_\n` +
      `• _Sisa budget makan_\n` +
      `• _Cek budget_\n\n` +
      
      `*📈 5. LIHAT TRANSAKSI*\n` +
      `• _Lihat transaksi hari ini_\n` +
      `• _Riwayat transaksi minggu ini_\n\n` +
      
      `*🗑️ 6. HAPUS TRANSAKSI*\n` +
      `• _Hapus transaksi terakhir_\n` +
      `• _Hapus kopi 25rb_\n\n` +
      
      `━━━━━━━━━━━━━━━━━━\n` +
      `💡 *TIPS:*\n` +
      `✅ Setiap transaksi butuh konfirmasi - balas *YA* untuk simpan\n` +
      `✅ Data otomatis sinkron ke web dashboard\n` +
      `✅ Bot paham bahasa natural - tulis dengan gaya Anda!\n\n` +
      
      `━━━━━━━━━━━━━━━━━━\n` +
      `🎯 *FITUR ADVANCED:*\n` +
      `• *Alokasi Gaji Otomatis:*\n` +
      `  _"Gaji 10jt bagi makan 40%, transport 20%, tabungan 40%"_\n\n` +
      
      `• *Transfer Antar Akun:*\n` +
      `  _"Transfer 500k dari BCA ke GoPay"_\n\n` +
      
      `━━━━━━━━━━━━━━━━━━\n` +
      `📱 *DASHBOARD WEB:*\n` +
      `Akses semua data Anda di:\n` +
      `https://fintrack-iota-three.vercel.app\n\n` +
      
      `━━━━━━━━━━━━━━━━━━\n` +
      `🤖 Ketik _halo_ atau _bantuan_ kapan saja untuk melihat menu ini lagi.\n\n` +
      `Selamat mencatat! 🚀✨`
    );
  }
}
