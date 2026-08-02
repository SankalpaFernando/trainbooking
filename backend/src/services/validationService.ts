export const isValidSriLankanNic = (value: string): boolean => {
  const trimmed = value?.trim();
  if (!trimmed) return false;
  const oldNic = /^\d{9}[VXvx]$/.test(trimmed);
  const newNic = /^\d{12}$/.test(trimmed);
  const passport = /^[A-Z0-9]{6,12}$/i.test(trimmed);
  return oldNic || newNic || passport;
};

export const isValidSriLankanPhone = (value: string): boolean => {
  const trimmed = value?.trim();
  if (!trimmed) return false;
  return /^(?:\+94|0)7\d{8}$/.test(trimmed);
};
