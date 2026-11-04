export function formatFaDate(input: string | Date): string {
  const d = typeof input === 'string' ? new Date(input) : input;
  return new Intl.DateTimeFormat('fa-IR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(d);
}

export function formatFaNumber(n: number): string {
  return new Intl.NumberFormat('fa-IR').format(n);
}
