import { db } from "@/lib/db";
import { categories } from "@/db/schema";
import { eq, and, or, isNull } from "drizzle-orm";
import { CreateCategoryInput, UpdateCategoryInput } from "@/schemas/category.schema";

export class CategoryService {
  /**
   * List available categories for the user (system default + user's custom categories)
   */
  static async getCategories(userId: string, type?: "INCOME" | "EXPENSE") {
    const conditions = [or(isNull(categories.userId), eq(categories.userId, userId))];

    if (type) {
      conditions.push(eq(categories.type, type));
    }

    return db
      .select()
      .from(categories)
      .where(and(...conditions))
      .orderBy(categories.type, categories.name);
  }

  /**
   * Create a custom category for the user
   */
  static async createCustomCategory(userId: string, input: CreateCategoryInput) {
    const [newCat] = await db
      .insert(categories)
      .values({
        userId,
        name: input.name,
        type: input.type,
        icon: input.icon || null,
        color: input.color || null,
        isDefault: false,
      })
      .returning();

    return newCat;
  }

  /**
   * Update user-owned category (strictly prevents modifying system default categories)
   */
  static async updateCategory(userId: string, categoryId: string, input: UpdateCategoryInput) {
    const [existing] = await db
      .select()
      .from(categories)
      .where(and(eq(categories.id, categoryId), eq(categories.userId, userId)))
      .limit(1);

    if (!existing) {
      return null; // Not found or is a default category belonging to system
    }

    const [updated] = await db
      .update(categories)
      .set({
        ...(input.name !== undefined && { name: input.name }),
        ...(input.icon !== undefined && { icon: input.icon }),
        ...(input.color !== undefined && { color: input.color }),
      })
      .where(eq(categories.id, categoryId))
      .returning();

    return updated ?? null;
  }

  /**
   * Delete custom category (strictly prevents deleting system default categories)
   */
  static async deleteCategory(userId: string, categoryId: string) {
    const [deleted] = await db
      .delete(categories)
      .where(and(eq(categories.id, categoryId), eq(categories.userId, userId)))
      .returning();

    return deleted ?? null;
  }
}
