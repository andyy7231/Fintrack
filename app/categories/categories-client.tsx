"use client";

import { useState } from "react";

interface Category {
  id: string;
  name: string;
  type: string;
  icon: string | null;
  color: string | null;
  isDefault: boolean;
  userId: string | null;
}

interface CategoriesClientProps {
  initialCategories: Category[];
}

export function CategoriesClient({ initialCategories }: CategoriesClientProps) {
  const [categoriesList, setCategoriesList] = useState<Category[]>(initialCategories);
  const [activeTab, setActiveTab] = useState<"ALL" | "EXPENSE" | "INCOME">("ALL");
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<"EXPENSE" | "INCOME">("EXPENSE");
  const [color, setColor] = useState("#3B82F6");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filtered = categoriesList.filter((cat) => {
    if (activeTab === "ALL") return true;
    return cat.type === activeTab;
  });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/v1/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, type, color }),
      });

      const json = await res.json();
      if (!json.success) {
        setError(json.error?.message || "Gagal membuat kategori.");
      } else {
        const refreshRes = await fetch("/api/v1/categories");
        const refreshJson = await refreshRes.json();
        if (refreshJson.success) {
          setCategoriesList(refreshJson.data);
        }
        setShowModal(false);
        setName("");
      }
    } catch {
      setError("Terjadi kesalahan jaringan.");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (catId: string, catName: string) => {
    if (!confirm(`Hapus kategori kustom "${catName}"?`)) return;

    try {
      const res = await fetch(`/api/v1/categories/${catId}`, { method: "DELETE" });
      const json = await res.json();
      if (json.success) {
        setCategoriesList((prev) => prev.filter((c) => c.id !== catId));
      } else {
        alert(json.error?.message || "Gagal menghapus kategori.");
      }
    } catch {
      alert("Gagal menghapus kategori.");
    }
  };

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            Kategori Transaksi
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Kelompokkan pengeluaran dan pemasukan Anda untuk pelacakan yang akurat
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="cursor-pointer self-start sm:self-auto rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
        >
          + Kategori Baru
        </button>
      </div>

      {/* Tabs */}
      <div className="mt-6 flex space-x-2 border-b border-zinc-200 dark:border-zinc-800">
        <button
          onClick={() => setActiveTab("ALL")}
          className={`cursor-pointer pb-2 text-sm font-medium ${
            activeTab === "ALL"
              ? "border-b-2 border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400"
              : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400"
          }`}
        >
          Semua ({categoriesList.length})
        </button>
        <button
          onClick={() => setActiveTab("EXPENSE")}
          className={`cursor-pointer pb-2 text-sm font-medium ${
            activeTab === "EXPENSE"
              ? "border-b-2 border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400"
              : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400"
          }`}
        >
          Pengeluaran ({categoriesList.filter((c) => c.type === "EXPENSE").length})
        </button>
        <button
          onClick={() => setActiveTab("INCOME")}
          className={`cursor-pointer pb-2 text-sm font-medium ${
            activeTab === "INCOME"
              ? "border-b-2 border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400"
              : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400"
          }`}
        >
          Pemasukan ({categoriesList.filter((c) => c.type === "INCOME").length})
        </button>
      </div>

      {/* Categories Grid */}
      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((cat) => (
          <div
            key={cat.id}
            className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white p-4 shadow-xs dark:border-zinc-800 dark:bg-zinc-900"
          >
            <div className="flex items-center space-x-3">
              <span
                className="h-3.5 w-3.5 rounded-full shrink-0"
                style={{ backgroundColor: cat.color || "#6B7280" }}
              />
              <div>
                <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  {cat.name}
                </p>
                <p className="text-xs text-zinc-400">
                  {cat.type === "INCOME" ? "Pemasukan" : "Pengeluaran"} •{" "}
                  {cat.isDefault ? "Bawaan Sistem" : "Kustom"}
                </p>
              </div>
            </div>

            {!cat.isDefault && (
              <button
                onClick={() => handleDelete(cat.id, cat.name)}
                className="cursor-pointer text-xs font-medium text-red-600 hover:text-red-700"
              >
                Hapus
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Modal Add Category */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-zinc-900">
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
              Buat Kategori Kustom
            </h2>

            {error && (
              <div className="mt-3 rounded-lg bg-red-50 p-3 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-400">
                {error}
              </div>
            )}

            <form onSubmit={handleCreate} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                  Nama Kategori
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Contoh: Asuransi, Langganan Netflix, Kripto"
                  className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                  Tipe Kategori
                </label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as "EXPENSE" | "INCOME")}
                  className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                >
                  <option value="EXPENSE">Pengeluaran (Expense)</option>
                  <option value="INCOME">Pemasukan (Income)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                  Pilihan Warna
                </label>
                <div className="mt-2 flex space-x-2">
                  {["#EF4444", "#F59E0B", "#10B981", "#3B82F6", "#8B5CF6", "#EC4899", "#6B7280"].map(
                    (c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setColor(c)}
                        className={`h-7 w-7 cursor-pointer rounded-full border-2 transition-transform ${
                          color === c ? "scale-110 border-zinc-900 dark:border-white" : "border-transparent"
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    )
                  )}
                </div>
              </div>

              <div className="mt-6 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="cursor-pointer rounded-lg border border-zinc-300 px-4 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="cursor-pointer rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? "Menyimpan..." : "Simpan Kategori"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
