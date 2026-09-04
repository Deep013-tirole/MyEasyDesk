// Self-contained, zero-dependency iconv-lite shim for Cloudflare Workers & edge runtimes
const encodings = new Set([
  'utf8', 'utf-8', 'ascii', 'latin1', 'binary', 'base64', 'hex',
  'ucs2', 'ucs-2', 'utf16le', 'utf-16le', 'iso-8859-1', 'windows-1252', 'us-ascii'
]);

function normalizeEncoding(enc) {
  if (!enc) return 'utf-8';
  const clean = String(enc).toLowerCase().trim();
  if (clean === 'utf8' || clean === 'utf-8') return 'utf-8';
  return clean;
}

function encodingExists(enc) {
  if (!enc) return false;
  const normalized = normalizeEncoding(enc);
  if (encodings.has(normalized)) return true;
  try {
    new TextDecoder(normalized);
    return true;
  } catch (e) {
    try {
      return typeof Buffer !== 'undefined' && Buffer.isEncoding && Buffer.isEncoding(normalized);
    } catch (err) {
      return false;
    }
  }
}

function decode(buf, encoding, options) {
  if (!buf) return '';
  const enc = normalizeEncoding(encoding);
  try {
    if (typeof buf === 'string') return buf;
    return new TextDecoder(enc, { fatal: false }).decode(buf);
  } catch (e) {
    try {
      return Buffer.from(buf).toString(enc);
    } catch (err) {
      return String(buf);
    }
  }
}

function encode(str, encoding, options) {
  if (str == null) return Buffer.alloc ? Buffer.alloc(0) : new Uint8Array(0);
  const enc = normalizeEncoding(encoding);
  try {
    if (enc === 'utf-8') {
      const u8 = new TextEncoder().encode(String(str));
      return typeof Buffer !== 'undefined' ? Buffer.from(u8.buffer, u8.byteOffset, u8.byteLength) : u8;
    }
    return Buffer.from(String(str), enc);
  } catch (e) {
    const u8 = new TextEncoder().encode(String(str));
    return typeof Buffer !== 'undefined' ? Buffer.from(u8.buffer, u8.byteOffset, u8.byteLength) : u8;
  }
}

function getDecoder(encoding, options) {
  const enc = normalizeEncoding(encoding);
  let decoder = null;
  try {
    decoder = new TextDecoder(enc, { fatal: false });
  } catch (e) {}

  return {
    write: function(buf) {
      if (!buf) return '';
      if (decoder) {
        return decoder.decode(buf, { stream: true });
      }
      return decode(buf, enc, options);
    },
    end: function() {
      if (decoder) {
        return decoder.decode();
      }
      return '';
    }
  };
}

function getEncoder(encoding, options) {
  const enc = normalizeEncoding(encoding);
  return {
    write: function(str) {
      return encode(str, enc, options);
    },
    end: function() {
      return Buffer.alloc ? Buffer.alloc(0) : new Uint8Array(0);
    }
  };
}

function getCodec(encoding) {
  if (!encodingExists(encoding)) {
    throw new Error("Encoding not recognized: '" + encoding + "' (searched as '" + encoding + "')");
  }
  return {
    bomAware: true,
    decoder: function(options) {
      return getDecoder(encoding, options);
    },
    encoder: function(options) {
      return getEncoder(encoding, options);
    }
  };
}

const iconv = {
  encode,
  decode,
  encodingExists,
  toEncoding: encode,
  fromEncoding: decode,
  getCodec,
  getDecoder,
  getEncoder,
  supportsStreams: false,
  enableStreamingAPI: function() { return this; }
};

module.exports = iconv;
module.exports.default = iconv;
