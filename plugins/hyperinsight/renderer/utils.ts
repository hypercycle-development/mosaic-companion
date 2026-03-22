export function cn(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(' ');
}

export function formatUtcDate(dateString: string | null | undefined): string {
  if (!dateString) return '-';
  try {
    const date = new Date(dateString);
    // Returns "YYYY-MM-DD HH:mm:ss UTC"
    return date.toISOString().replace('T', ' ').substring(0, 19) + ' UTC';
  } catch (e) {
    return dateString || '-';
  }
}
