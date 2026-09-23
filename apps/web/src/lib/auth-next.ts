export function safeNextPath(value: string | null | undefined): string {
  return value && /^\/invite\/[a-zA-Z0-9_-]{43}$/.test(value) ? value : '/app';
}
