import { customAlphabet } from 'nanoid';
const alpha = customAlphabet('0123456789', 8);
export const generateMatricule = () => `BR-${new Date().getFullYear()}-${alpha()}`;
export const generateReferralCode = () => customAlphabet('ABCDEFGHJKMNPQRSTUVWXYZ23456789', 8)();
