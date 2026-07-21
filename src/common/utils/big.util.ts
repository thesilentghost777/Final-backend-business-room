export const b = (v: number | bigint | string) => BigInt(v);
export const bigStr = <T>(o: T): T => JSON.parse(JSON.stringify(o, (_k, v) => typeof v === 'bigint' ? v.toString() : v));
