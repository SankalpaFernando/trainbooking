export class ValidationService{
    public static isValidSriLankanNic(value: string) {
    const trimmed = value?.trim();
    if (!trimmed) return false;
    const oldNic = /^\d{9}[VXvx]$/.test(trimmed);
    const newNic = /^\d{12}$/.test(trimmed);
    const passport = /^(?=.*[A-Z])(?=.*\d)[A-Z0-9]{6,12}$/i.test(trimmed);
    return oldNic || newNic || passport;
    }

    public static isValidSriLankanPhone(value: string)  {
    const trimmed = value?.trim();
    if (!trimmed) return false;
    return /^(?:\+94|0)7\d{8}$/.test(trimmed);
    }
}