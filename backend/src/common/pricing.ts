/** Допустимые тарифы: 0 (бесплатно), 50, 100, 200 сом; customPrice — персональная цена */
export const PRICE_TIERS = [0, 50, 100, 200] as const;

export function effectivePrice(lesson: { priceTier: number; customPrice: number | null }): number {
  return lesson.customPrice ?? lesson.priceTier;
}
