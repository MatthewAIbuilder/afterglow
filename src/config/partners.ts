/**
 * Shop links for the Get ready packing list: pack item id -> an https link
 * (an Amazon Associates link, or a brand's own affiliate link). Empty means no
 * Shop links anywhere. Item ids are in `features/prep/checklist.ts` (`PACK`):
 * id, power, earplugs, water, sun, rain, meet. See docs/money.md.
 *
 * Example once approved:
 *   earplugs: 'https://www.amazon.com/dp/XXXXXXXXXX?tag=afterglow-20',
 */
export const SHOP_LINKS: Readonly<Record<string, string>> = {};
