---
title: WhatsApp Natural Language Transaction Parser - Master Architecture Specification
status: reference
scope: future-task
applies-to: whatsapp-nlp-parser
created: 2025-01-01
---

# WhatsApp Natural Language Transaction Parser

> **CRITICAL: This is an ARCHITECTURAL REFERENCE DOCUMENT for future implementation.**
> 
> **DO NOT apply this to current bugfix tasks.**
> 
> **Use this as specification for a NEW, SEPARATE task dedicated to WhatsApp NLP parser implementation/validation.**

================================================
ROLE
================================================

Anda adalah Senior Backend Engineer, AI/NLP Engineer, Database Engineer, Security Engineer, dan QA Engineer.

Tugas Anda adalah mengimplementasikan sistem parser pesan WhatsApp untuk aplikasi personal finance FinTrack.

Parser harus mampu mengubah bahasa natural Bahasa Indonesia menjadi structured financial intent yang tervalidasi sebelum dapat menyentuh database.

PRINSIP UTAMA:

Data Integrity > Security > Correctness > Deterministic Parsing > Validation > Reliability > Maintainability > UX > AI/LLM flexibility

Jangan membuat parser yang hanya bergantung pada keyword sederhana.

Jangan pernah membiarkan output AI/LLM langsung melakukan database mutation.

================================================
1. PROJECT CONTEXT
================================================

Nama: FinTrack

Tujuan: Pengguna dapat mencatat transaksi keuangan melalui WhatsApp menggunakan bahasa Indonesia sehari-hari.

Contoh:
- "makan siang 25k" → EXPENSE, amount=25000, category=Food
- "gajian 7,5 juta" → INCOME, amount=7500000, category=Salary
- "bayar kos 1,2jt" → EXPENSE, amount=1200000, category=Housing
- "transfer BCA ke GoPay 100k" → TRANSFER, fromAccount=BCA, toAccount=GoPay, amount=100000

================================================
2. CURRENT TECH STACK
================================================

- Next.js App Router
- TypeScript
- PostgreSQL
- Drizzle ORM
- Better Auth
- Zod
- Vercel
- Supabase PostgreSQL
- WhatsApp Business Platform / Cloud API
- AI/LLM hanya sebagai fallback parser bila diperlukan

Database adalah source of truth.
Authentication source of truth adalah Better Auth server session.

================================================
3. IMPORTANT ARCHITECTURE
================================================

Gunakan pipeline:

WhatsApp Message
       ↓
Webhook Verification
       ↓
User Identification
       ↓
Raw Message Storage
       ↓
Text Normalization
       ↓
Deterministic / Rule-Based Parser
       ↓
LLM Parser jika diperlukan
       ↓
Structured Parser Output
       ↓
Zod Validation
       ↓
Business Validation
       ↓
Confidence / Ambiguity Check
       ↓
Confirmation jika diperlukan
       ↓
Database Transaction
       ↓
WhatsApp Response

JANGAN:
WhatsApp → LLM → SQL INSERT

JANGAN pernah membiarkan LLM menghasilkan SQL.

================================================
4. PRIMARY INTENTS
================================================

Untuk MVP gunakan intent berikut:

- **EXPENSE**: Pengeluaran
- **INCOME**: Pemasukan
- **TRANSFER**: Perpindahan uang antar account milik user
- **UNKNOWN**: Pesan tidak cukup jelas

Jangan membuat terlalu banyak intent pada tahap awal.

------------------------------------------------
EXPENSE
------------------------------------------------
Contoh:
- "makan siang 25k"
- "beli sepatu 500rb"
- "bayar kos 1,2jt"

------------------------------------------------
INCOME
------------------------------------------------
Contoh:
- "gajian 7,5jt"
- "dapat bonus 2jt"
- "freelance masuk 500k"

------------------------------------------------
TRANSFER
------------------------------------------------
Contoh:
- "transfer BCA ke GoPay 100k"
- "pindahin 500rb dari BCA ke Mandiri"
- "top up GoPay 100k dari BCA"

TRANSFER bukan EXPENSE.
TRANSFER bukan INCOME.

------------------------------------------------
UNKNOWN
------------------------------------------------
Contoh:
- "halo"
- "pagi"
- "apa kabar"
- "tadi keluar 100k" (ambiguous)

================================================
5. CANONICAL STRUCTURED OUTPUT
================================================

Parser harus menghasilkan object terstruktur:

\\\json
{
  "intent": "EXPENSE | INCOME | TRANSFER | UNKNOWN",
  "amount": 25000,
  "currency": "IDR",
  "category": "Food",
  "account": null,
  "fromAccount": null,
  "toAccount": null,
  "description": "makan siang",
  "transactionDate": null,
  "confidence": 0.98,
  "needsConfirmation": false
}
\\\

================================================
6. STRICT PARSING RULE
================================================

Parser harus membedakan: Intent, Entity, Context, Confidence

Jangan menentukan intent hanya dari satu keyword.

Contoh:
- "gaji 7jt" → INCOME
- "bayar gaji 7jt" → kemungkinan EXPENSE (context matters)
- "transfer 100k" → TRANSFER tetapi account belum diketahui
- "uang masuk 500k" → kemungkinan INCOME
- "uang masuk ke GoPay 500k dari BCA" → TRANSFER
- "keluar 100k" → ambiguous

Jangan melakukan asumsi agresif.

================================================
7. AMOUNT NORMALIZATION
================================================

Parser WAJIB memahami:

- 25k, 25K, 25rb, 25RB, 25 ribu, 25ribu, 25 ribuan, 25000, 25.000, Rp25.000 → 25000
- 1jt, 1JT, 1 juta, 1juta, 1000000, 1.000.000 → 1000000
- 1,5jt, 1.5jt, 1,5 juta, 1.500.000 → 1500000 (Bahasa Indonesia decimal)
- 7,5 juta → 7500000
- 1,25jt → 1250000

================================================
8. AMOUNT SAFETY
================================================

Amount harus:
- numeric
- > 0
- valid
- tidak NaN
- tidak Infinity
- tidak negative
- tidak ambigu

Jangan menyimpan "-25000" untuk expense.
Gunakan: type=EXPENSE, amount=25000

Amount authoritative harus menggunakan PostgreSQL NUMERIC/DECIMAL.

================================================
9. EXPENSE CATEGORY
================================================

Default expense categories:

**Food**: makan, makanan, sarapan, makan siang, ngopi, kopi, jajan, warteg, restoran, nasi goreng, ayam geprek, sayur

**Transportation**: grab, gojek, ojek, bensin, parkir, tol, KRL, MRT, bus, kereta, taksi, ongkos

**Housing**: kos, kontrakan, sewa rumah

**Utilities**: listrik, token, air, internet, wifi

**Shopping**: baju, sepatu, belanja, barang, sabun, kebutuhan

**Health**: obat, dokter, rumah sakit, vitamin

**Education**: kuliah, kursus, buku, print, fotokopi, pendidikan

**Entertainment**: bioskop, game, karaoke, hiburan

**Bills**: tagihan, bill, bayar tagihan

Jika tidak cukup jelas: **Other Expense** atau NEED_CONFIRMATION

================================================
10. INCOME CATEGORY
================================================

Default income categories:

**Salary**: gaji, gajian, salary, upah

**Bonus**: bonus, THR, tunjangan tambahan

**Freelance**: freelance, freelancer, project freelance

**Business**: jualan, penjualan, hasil jualan, usaha

**Gift**: dikasih uang, dapat hadiah, pemberian, uang dari orang tua

Jika tidak dapat ditentukan: **Other Income**

================================================
11. TRANSFER DETECTION
================================================

TRANSFER harus memiliki prioritas deteksi yang tinggi.

Contoh:
- "transfer BCA ke GoPay 100k" → TRANSFER
- "pindah uang BCA ke Mandiri 500k" → TRANSFER
- "top up GoPay dari BCA 100k" → TRANSFER
- "isi saldo DANA dari BCA 100k" → TRANSFER

Jangan mengklasifikasikan top up account internal sebagai expense.

================================================
12. TRANSFER VALIDATION
================================================

TRANSFER membutuhkan: amount, fromAccount, toAccount

Jika source/destination tidak lengkap: needsConfirmation = true

Contoh:
- "transfer 100k" → TRANSFER, amount=100000, fromAccount=null, toAccount=null, needsConfirmation=true

Jangan langsung membuat transfer database.

================================================
13. ACCOUNT RECOGNITION
================================================

Parser harus mengenali account jika disebutkan.

Contoh:
- "makan 25k pakai BCA" → account=BCA
- "makan 25k pakai GoPay" → account=GoPay
- "gajian 7,5jt masuk BCA" → account=BCA
- "bayar listrik 150k dari Mandiri" → account=Mandiri

Untuk transfer:
- "transfer BCA ke GoPay 100k" → fromAccount=BCA, toAccount=GoPay

================================================
14. ACCOUNT NAME MATCHING
================================================

Account name harus dicocokkan dengan account yang dimiliki user (case-insensitive).

Database: BCA, Mandiri, GoPay, OVO, DANA, Cash

User input:
- "bca" → BCA
- "go pay" → GoPay

Jangan membuat account baru otomatis.

Jika account tidak ditemukan: needsConfirmation = true

================================================
15. DESCRIPTION EXTRACTION
================================================

Parser harus memisahkan description dari amount dan metadata.

Contoh:
- "makan siang sama Andi 35k" → description="makan siang sama Andi", amount=35000
- "grab ke kantor 25k" → description="grab ke kantor", amount=25000

Description tidak boleh berisi amount yang sudah diekstrak.

================================================
16. DATE PARSING
================================================

Minimal dukung:
- hari ini → current date
- tadi → current date
- kemarin → current date - 1 day

Contoh:
- "makan 25k kemarin" → transactionDate = yesterday

Timezone: Asia/Jakarta

Jika tanggal ambigu: needsConfirmation = true

================================================
17. NATURAL LANGUAGE VARIATION
================================================

Parser harus memahami bahasa sehari-hari:

- "tadi pagi beli kopi 18k"
- "barusan makan siang 25rb"
- "habis 50k buat bensin"
- "aku baru bayar kos 1.2jt"
- "gaji bulan ini masuk 7,5jt"
- "dapat bonus kantor 2 juta"
- "tadi top up gopay 100rb dari bca"
- "pindahin 500k dari bca ke mandiri"

================================================
18. WORD ORDER
================================================

Parser tidak boleh bergantung pada urutan kata.

Semua berikut harus dikenali:
- "makan siang 25k"
- "25k makan siang"
- "tadi makan siang 25k"
- "tadi 25k buat makan siang"
- "makan siang tadi habis 25 ribu"

Expected: EXPENSE, Food, 25000

================================================
19. AMBIGUOUS INPUT
================================================

Jangan memaksakan klasifikasi.

Contoh ambiguous:
- "tadi makan" → amount missing
- "bayar sesuatu 50k" → category unclear
- "keluar 100k" → income/expense unclear
- "masuk 500k" → income/transfer unclear
- "transfer 100k" → account missing

Semua harus: needsConfirmation = true atau UNKNOWN

================================================
20. UNKNOWN INPUT
================================================

Pesan non-financial:
- "halo", "pagi", "apa kabar", "oke", "makasih", "wkwk", "iya"

tidak boleh dibuat menjadi transaction.

Parser harus: UNKNOWN, needsConfirmation=false

================================================
21. CONFIDENCE
================================================

Confidence adalah sinyal internal, bukan alasan untuk langsung database mutation.

- confidence >= 0.90 → high confidence (if all required fields complete)
- 0.70–0.89 → review business validation
- < 0.70 → confirmation atau UNKNOWN

Required fields tetap harus divalidasi.

================================================
22. RULE-BASED FIRST
================================================

Gunakan pendekatan:

RULE-BASED FIRST
↓
STRUCTURED PARSING
↓
LLM FALLBACK

Untuk pesan sederhana "makan 25k" jangan panggil LLM.

LLM hanya digunakan ketika:
- bahasa kompleks
- intent ambigu
- category sulit ditentukan
- struktur kalimat tidak biasa

================================================
23. LLM OUTPUT
================================================

Jika menggunakan LLM:

LLM hanya boleh menghasilkan structured JSON.

Output harus melewati Zod validation.

Jangan pernah: LLM → SQL
Jangan pernah: LLM → database mutation

Selalu: LLM → Zod → Business Validation → Database

================================================
24. ZOD SCHEMA
================================================

Buat schema khusus parser:
- TransactionIntentSchema
- ParserResultSchema
- TransferParserResultSchema

Gunakan strict validation.

================================================
25. DATABASE SAFETY
================================================

Parser tidak boleh menentukan user_id berdasarkan pesan WhatsApp.

user_id harus berasal dari authenticated WhatsApp connection.

Flow:
WhatsApp phone/account → WhatsApp connection → FinTrack user_id → parser → validated transaction → database

Parser hanya menentukan transaction semantics.

================================================
26. USER ISOLATION
================================================

Jika user A mengirim "makan 25k pakai BCA" dan user A memiliki BCA:
→ gunakan BCA milik User A.

Jangan pernah menggunakan account milik user lain.

Jika account tidak ditemukan: confirmation/error

================================================
27. CONFIRMATION FLOW
================================================

Jika informasi tidak cukup: JANGAN INSERT.

Contoh:
User: "transfer 100k"
Bot: "Transfer Rp100.000 dari akun mana ke akun mana?"
User: "BCA ke GoPay"
→ Baru parser menghasilkan: TRANSFER, 100000, BCA, GoPay

================================================
28. DUPLICATE PROTECTION
================================================

Parser harus compatible dengan webhook idempotency.

WhatsApp message memiliki: external_message_id

Database harus mencegah satu WhatsApp message membuat dua transaksi.

Gunakan unique constraint pada: external_message_id

================================================
29. RAW MESSAGE
================================================

Simpan raw incoming message sebelum parsing.

Minimal:
- external_message_id
- user/connection reference
- raw_message
- received_at
- parsed_data
- status (RECEIVED, PARSED, WAITING_CONFIRMATION, PROCESSED, FAILED, IGNORED)

================================================
30. DATASET / REGRESSION TEST
================================================

Buat dataset test yang berisi input dan expected output.

Minimal test cases:

**EXPENSE TESTS**:
- "makan siang 25k" → EXPENSE / Food / 25000
- "grab 25k" → EXPENSE / Transportation / 25000
- "bayar kos 1,2jt" → EXPENSE / Housing / 1200000

**INCOME TESTS**:
- "gajian 7,5 juta" → INCOME / Salary / 7500000
- "dapat bonus 2jt" → INCOME / Bonus / 2000000

**TRANSFER TESTS**:
- "transfer dari BCA ke GoPay 100k" → TRANSFER / 100000 / BCA → GoPay

**AMBIGUOUS TESTS**:
- "tadi makan" → NEED_CONFIRMATION
- "keluar 100k" → NEED_CONFIRMATION

**UNKNOWN TESTS**:
- "halo" → UNKNOWN

================================================
31. SECURITY
================================================

Jangan:
- trust user_id dari message
- trust account_id dari client
- trust category_id dari LLM
- execute SQL dari LLM
- store plaintext secrets
- expose internal errors
- bypass authorization

Semua entity harus divalidasi terhadap authenticated user.

================================================
32. TEST REQUIREMENTS
================================================

Minimal:
- npm run lint
- npx tsc --noEmit
- npm run build
- parser regression tests

Target:
- 0 TypeScript errors
- 0 lint errors
- 100% regression dataset expected cases pass

================================================
33. DO NOT OVERENGINEER
================================================

Jangan langsung membuat:
- multi-language NLP
- voice recognition
- OCR
- AI financial advisor
- sentiment analysis
- machine learning model training
- vector database
- embeddings
- RAG
- complex agent architecture

FinTrack hanya membutuhkan parser transaksi yang reliable.

Gunakan deterministic parser sebanyak mungkin.
LLM adalah fallback, bukan sumber kebenaran.

================================================
34. IMPLEMENTATION ORDER
================================================

Kerjakan secara berurutan:
A. Inspect existing repository
B. Inspect database schema
C. Inspect transaction/account/category services
D. Implement text normalization
E. Implement amount parser
F. Implement intent parser
G. Implement category parser
H. Implement account parser
I. Implement date parser
J. Implement structured parser
K. Implement Zod validation
L. Implement ambiguity detection
M. Implement regression dataset
N. Implement tests
O. Integrate with WhatsApp (if infrastructure exists)
P. Run lint
Q. Run typecheck
R. Run build
S. Run regression suite

================================================
35. ACCEPTANCE CRITERIA
================================================

Task dianggap PASS apabila:

PARSER:
- [x] Expense dikenali
- [x] Income dikenali
- [x] Transfer dikenali
- [x] Unknown dikenali
- [x] Amount normalization bekerja (k/K/rb/ribu/jt/juta/decimal)
- [x] Account dikenali
- [x] Category dikenali
- [x] Description diekstrak
- [x] Date sederhana dikenali
- [x] Ambiguity terdeteksi
- [x] Word order variation bekerja

SECURITY:
- [x] Parser tidak menentukan user_id
- [x] LLM tidak dapat execute SQL
- [x] LLM output divalidasi Zod
- [x] Account diverifikasi terhadap user
- [x] Category diverifikasi terhadap user
- [x] Database mutation dilakukan oleh service
- [x] Duplicate WhatsApp message tidak membuat duplicate transaction

QUALITY:
- [x] lint PASS
- [x] typecheck PASS
- [x] build PASS
- [x] regression tests PASS
- [x] no unnecessary dependency
- [x] no unrelated feature modified

================================================
36. FINAL PRINCIPLE
================================================

FinTrack adalah aplikasi keuangan.

Parser yang "terlihat pintar" tetapi salah mencatat transaksi lebih buruk daripada parser yang meminta konfirmasi.

**JIKA YAKIN → PARSE**
**JIKA CUKUP YAKIN DAN DATA LENGKAP → VALIDATE**
**JIKA AMBIGUOUS → ASK CONFIRMATION**
**JIKA BUKAN TRANSAKSI → UNKNOWN**

**JANGAN MENEBAK DATA KEUANGAN.**

Never guess money.
Never guess account ownership.
Never guess transfer destination.
Never trust raw LLM output.
Never allow an ambiguous message to directly mutate the database.

================================================
END OF SPECIFICATION
================================================
