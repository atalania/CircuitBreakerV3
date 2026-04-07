export function isValidLabPlaceKind(kind) {
  if (!kind) return false;
  const simple = ["and", "or", "not", "xor", "nand", "nor", "sr", "jk", "led", "low", "high"];
  if (simple.includes(kind)) return true;
  if (kind.startsWith("in:") && kind.length > 3) return true;
  if (kind.startsWith("led:") && kind.length > 4) return true;
  return false;
}
