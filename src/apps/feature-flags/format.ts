export function formatDate(value: Date) {
  return value.toISOString().slice(0, 16).replace("T", " ");
}
