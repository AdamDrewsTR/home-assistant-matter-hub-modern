// Matter string limits count UTF-8 bytes, so CJK names must be cut by bytes (#518)
export function trimToLength(
  value: string | number | null | undefined,
  maxLength: number,
  suffix: string,
): string | undefined {
  const stringValue = value?.toString();
  if (!stringValue?.trim().length) {
    return undefined;
  }
  if (Buffer.byteLength(stringValue) <= maxLength) {
    return stringValue;
  }
  let room = maxLength - Buffer.byteLength(suffix);
  let trimmed = "";
  for (const char of stringValue) {
    room -= Buffer.byteLength(char);
    if (room < 0) break;
    trimmed += char;
  }
  return trimmed + suffix;
}
