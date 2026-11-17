import { Timestamp } from 'firebase/firestore';
import { APP_LIMITS, Category, Contribution } from '../types';

export function normalizeCategoryName(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ').slice(0, APP_LIMITS.categoryNameMax);
}

export function findDuplicateCategory(
  rawName: string,
  categories: Category[],
  excludeId?: string
): Category | undefined {
  const normalized = normalizeCategoryName(rawName).toLowerCase();
  if (!normalized) return undefined;
  return categories.find(
    (c) =>
      c.id !== excludeId &&
      normalizeCategoryName(c.name).toLowerCase() === normalized
  );
}

function getTimestampMillis(ts?: Timestamp | null): number {
  if (!ts || typeof ts.toMillis !== 'function') {
    return 0;
  }
  return ts.toMillis();
}

/**
 * Sorts categories by most recently used first (`lastUsedAt` descending).
 * Unused categories appear after used ones, preserving creation order.
 */
export function sortCategoriesByLastUsed(categories: Category[]): Category[] {
  return [...categories].sort((a, b) => {
    const aUsed = getTimestampMillis(a.lastUsedAt);
    const bUsed = getTimestampMillis(b.lastUsedAt);

    if (aUsed !== bUsed) {
      return bUsed - aUsed;
    }

    const aCreated = getTimestampMillis(a.createdAt);
    const bCreated = getTimestampMillis(b.createdAt);
    if (aCreated !== bCreated) {
      return aCreated - bCreated;
    }

    return a.name.localeCompare(b.name, 'it');
  });
}

export function resolveContributionCategoryLabel(
  entry: Contribution,
  categoriesById: Map<string, Category>
): string {
  if (entry.categoryId) {
    const match = categoriesById.get(entry.categoryId);
    if (match) {
      return match.name;
    }
  }
  return entry.sourceTag;
}
