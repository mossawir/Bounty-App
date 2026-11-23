export type PageToken = number | 'gap';

/**
 * First page, last page and a window around the current one.
 * Everything in between collapses to an ellipsis.
 */
export function pageWindow(page: number, pageCount: number): PageToken[] {
  if (pageCount <= 7) {
    return Array.from({ length: pageCount }, (_, index) => index + 1);
  }

  const visible = new Set<number>([1, pageCount, page - 1, page, page + 1]);
  if (page <= 3) [2, 3, 4].forEach((value) => visible.add(value));
  if (page >= pageCount - 2) {
    [pageCount - 1, pageCount - 2, pageCount - 3].forEach((value) => visible.add(value));
  }

  const sorted = [...visible]
    .filter((value) => value >= 1 && value <= pageCount)
    .sort((a, b) => a - b);
  const tokens: PageToken[] = [];

  sorted.forEach((value, index) => {
    const previous = sorted[index - 1];
    if (previous !== undefined && value - previous > 1) tokens.push('gap');
    tokens.push(value);
  });

  return tokens;
}
