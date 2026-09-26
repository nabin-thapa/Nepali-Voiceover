/**
 * Minimal MessagePack encoder for Fish Audio TTS `references` payloads.
 * Supports: null, boolean, number (int/float), string, Buffer/Uint8Array, Array, plain Object.
 * Used only when fishMultiReference is enabled (default OFF).
 */
export type MsgpackValue =
  | null
  | boolean
  | number
  | string
  | Uint8Array
  | MsgpackValue[]
  | { [k: string]: MsgpackValue };

function encodeNumber(n: number): Buffer {
  if (Number.isInteger(n)) {
    if (n >= 0 && n <= 127) return Buffer.from([n]);
    if (n < 0 && n >= -32) return Buffer.from([0xe0 | (n + 32)]);
    if (n >= 0 && n <= 0xff) return Buffer.from([0xcc, n]);
    if (n >= 0 && n <= 0xffff) {
      const b = Buffer.alloc(3);
      b[0] = 0xcd;
      b.writeUInt16BE(n, 1);
      return b;
    }
    if (n >= 0 && n <= 0xffffffff) {
      const b = Buffer.alloc(5);
      b[0] = 0xce;
      b.writeUInt32BE(n, 1);
      return b;
    }
    const b = Buffer.alloc(9);
    b[0] = 0xcf;
    b.writeBigInt64BE(BigInt(n), 1);
    return b;
  }
  const b = Buffer.alloc(9);
  b[0] = 0xcb;
  b.writeDoubleBE(n, 1);
  return b;
}

function encodeStr(s: string): Buffer {
  const raw = Buffer.from(s, "utf-8");
  const len = raw.length;
  if (len <= 31) {
    return Buffer.concat([Buffer.from([0xa0 | len]), raw]);
  }
  if (len <= 0xff) {
    return Buffer.concat([Buffer.from([0xd9, len]), raw]);
  }
  if (len <= 0xffff) {
    const h = Buffer.alloc(3);
    h[0] = 0xda;
    h.writeUInt16BE(len, 1);
    return Buffer.concat([h, raw]);
  }
  const h = Buffer.alloc(5);
  h[0] = 0xdb;
  h.writeUInt32BE(len, 1);
  return Buffer.concat([h, raw]);
}

function encodeBin(bin: Uint8Array): Buffer {
  const len = bin.length;
  if (len <= 0xff) {
    return Buffer.concat([Buffer.from([0xc4, len]), Buffer.from(bin)]);
  }
  if (len <= 0xffff) {
    const h = Buffer.alloc(3);
    h[0] = 0xc5;
    h.writeUInt16BE(len, 1);
    return Buffer.concat([h, Buffer.from(bin)]);
  }
  const h = Buffer.alloc(5);
  h[0] = 0xc6;
  h.writeUInt32BE(len, 1);
  return Buffer.concat([h, Buffer.from(bin)]);
}

function encodeArray(arr: MsgpackValue[]): Buffer {
  const parts: Buffer[] = [];
  const len = arr.length;
  if (len <= 15) parts.push(Buffer.from([0x90 | len]));
  else if (len <= 0xffff) {
    const h = Buffer.alloc(3);
    h[0] = 0xdc;
    h.writeUInt16BE(len, 1);
    parts.push(h);
  } else {
    const h = Buffer.alloc(5);
    h[0] = 0xdd;
    h.writeUInt32BE(len, 1);
    parts.push(h);
  }
  for (const v of arr) parts.push(encodeValue(v));
  return Buffer.concat(parts);
}

function encodeMap(obj: { [k: string]: MsgpackValue }): Buffer {
  const keys = Object.keys(obj);
  const parts: Buffer[] = [];
  const len = keys.length;
  if (len <= 15) parts.push(Buffer.from([0x80 | len]));
  else if (len <= 0xffff) {
    const h = Buffer.alloc(3);
    h[0] = 0xde;
    h.writeUInt16BE(len, 1);
    parts.push(h);
  } else {
    const h = Buffer.alloc(5);
    h[0] = 0xdf;
    h.writeUInt32BE(len, 1);
    parts.push(h);
  }
  for (const k of keys) {
    parts.push(encodeStr(k));
    parts.push(encodeValue(obj[k]));
  }
  return Buffer.concat(parts);
}

function encodeValue(v: MsgpackValue): Buffer {
  if (v === null || v === undefined) return Buffer.from([0xc0]);
  if (typeof v === "boolean") return Buffer.from([v ? 0xc3 : 0xc2]);
  if (typeof v === "number") return encodeNumber(v);
  if (typeof v === "string") return encodeStr(v);
  if (v instanceof Uint8Array || Buffer.isBuffer(v)) return encodeBin(v);
  if (Array.isArray(v)) return encodeArray(v);
  if (typeof v === "object") return encodeMap(v as { [k: string]: MsgpackValue });
  throw new Error(`msgpack: unsupported type ${typeof v}`);
}

export function encodeMsgpack(value: MsgpackValue): Buffer {
  return encodeValue(value);
}
