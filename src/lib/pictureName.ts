/** A file name from a title: "My EDC Orlando 2026" -> "my-edc-orlando-2026" ("afterglow" when nothing's left). */
export function pictureName(title: string): string {
  const slug = title
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/, '');
  return slug || 'afterglow';
}
