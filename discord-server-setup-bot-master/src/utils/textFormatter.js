// ============================================================
// 🎨 Cute Text Formatter
// Converts plain text into aesthetic Unicode font styles.
// NOTE: formatCute() lowercases input, so only lowercase glyph
// maps are required. Uppercase ranges are still built for reuse.
// ============================================================

// Build a Latin alphabet (+ optional digits) map from Unicode code-point bases.
// `overrides` patches "holes" in the math-alphanumeric blocks (reserved letters
// that live elsewhere in Unicode, e.g. italic small "h" = U+210E).
function buildMap({ lowerBase, upperBase, digitBase, overrides = {} }) {
  const map = {};
  for (let i = 0; i < 26; i++) {
    if (typeof lowerBase === 'number') {
      map[String.fromCharCode(97 + i)] = String.fromCodePoint(lowerBase + i);
    }
    if (typeof upperBase === 'number') {
      map[String.fromCharCode(65 + i)] = String.fromCodePoint(upperBase + i);
    }
  }
  if (typeof digitBase === 'number') {
    for (let d = 0; d < 10; d++) {
      map[String(d)] = String.fromCodePoint(digitBase + d);
    }
  }
  return Object.assign(map, overrides);
}

// --- Static aesthetic maps (hand-authored spacing/shape styles) ---
const wideMap = {
  a:'ａ',b:'ｂ',c:'ｃ',d:'ｄ',e:'ｅ',f:'ｆ',g:'ｇ',h:'ｈ',i:'ｉ',j:'ｊ',k:'ｋ',l:'ｌ',m:'ｍ',
  n:'ｎ',o:'ｏ',p:'ｐ',q:'ｑ',r:'ｒ',s:'ｓ',t:'ｔ',u:'ｕ',v:'ｖ',w:'ｗ',x:'ｘ',y:'ｙ',z:'ｚ',
  '0':'０','1':'１','2':'２','3':'３','4':'４','5':'５','6':'６','7':'７','8':'８','9':'９',
  '-':'－','_':'＿',' ':'　'
};

const smallCapsMap = {
  a:'ᴀ',b:'ʙ',c:'ᴄ',d:'ᴅ',e:'ᴇ',f:'ꜰ',g:'ɢ',h:'ʜ',i:'ɪ',j:'ᴊ',k:'ᴋ',l:'ʟ',m:'ᴍ',
  n:'ɴ',o:'ᴏ',p:'ᴘ',q:'ǫ',r:'ʀ',s:'s',t:'ᴛ',u:'ᴜ',v:'ᴠ',w:'ᴡ',x:'x',y:'ʏ',z:'ᴢ'
};

const bubblesMap = {
  a:'ⓐ',b:'ⓑ',c:'ⓒ',d:'ⓓ',e:'ⓔ',f:'ⓕ',g:'ⓖ',h:'ⓗ',i:'ⓘ',j:'ⓙ',k:'ⓚ',l:'ⓛ',m:'ⓜ',
  n:'ⓝ',o:'ⓞ',p:'ⓟ',q:'ⓠ',r:'ⓡ',s:'ⓢ',t:'ⓣ',u:'ⓤ',v:'ⓥ',w:'ⓦ',x:'ⓧ',y:'ⓨ',z:'ⓩ',
  '0':'⓪','1':'①','2':'②','3':'③','4':'④','5':'⑤','6':'⑥','7':'⑦','8':'⑧','9':'⑨'
};

const upsideDownMap = {
  a:'ɐ',b:'q',c:'ɔ',d:'p',e:'ǝ',f:'ɟ',g:'ƃ',h:'ɥ',i:'ᴉ',j:'ɾ',k:'ʞ',l:'l',m:'ɯ',
  n:'u',o:'o',p:'d',q:'b',r:'ɹ',s:'s',t:'ʇ',u:'n',v:'ʌ',w:'ʍ',x:'x',y:'ʎ',z:'z',
  '.':'˙',',':'\'','?':'¿','!':'¡','\'':',','"':',,','(':')',')':'('
};

// --- Math-alphanumeric maps built programmatically (correct ranges + holes) ---
const boldMap        = buildMap({ lowerBase: 0x1D41A, upperBase: 0x1D400, digitBase: 0x1D7CE });
const italicMap      = buildMap({ lowerBase: 0x1D44E, upperBase: 0x1D434, overrides: { h:'ℎ' } });
const boldItalicMap  = buildMap({ lowerBase: 0x1D482, upperBase: 0x1D468 });
const monospaceMap   = buildMap({ lowerBase: 0x1D68A, upperBase: 0x1D670, digitBase: 0x1D7F6 });
const doubleStruckMap = buildMap({
  lowerBase: 0x1D552, upperBase: 0x1D538, digitBase: 0x1D7D8,
  overrides: { C:'ℂ', H:'ℍ', N:'ℕ', P:'ℙ', Q:'ℚ', R:'ℝ', Z:'ℤ' }
});
const frakturMap = buildMap({
  lowerBase: 0x1D51E, upperBase: 0x1D504,
  overrides: { C:'ℭ', H:'ℌ', I:'ℑ', R:'ℜ', Z:'ℨ' }
});
const scriptMap = buildMap({
  lowerBase: 0x1D4B6, upperBase: 0x1D49C,
  overrides: {
    B:'ℬ', E:'ℰ', F:'ℱ', H:'ℋ', I:'ℐ', L:'ℒ', M:'ℳ', R:'ℛ',
    e:'ℯ', g:'ℊ', o:'ℴ'
  }
});

// Registry of character-substitution styles.
const STYLE_MAPS = {
  wide: wideMap,
  smallcaps: smallCapsMap,
  bubbles: bubblesMap,
  bold: boldMap,
  italic: italicMap,
  bolditalic: boldItalicMap,
  script: scriptMap,
  fraktur: frakturMap,
  doublestruck: doubleStruckMap,
  monospace: monospaceMap,
  upsidedown: upsideDownMap
};

// Combining-diacritic styles applied to every character.
const COMBINING = {
  strikethrough: '\u0336',
  underline: '\u0332'
};

module.exports = {
  // Expose the list so commands/help can stay in sync automatically.
  CUTE_STYLES: [...Object.keys(STYLE_MAPS), ...Object.keys(COMBINING)],

  formatCute(text, style, emoji) {
    if (!text) return '';
    const lowerText = String(text).toLowerCase();

    // Normalize alternate naming (small-caps, upside-down, double-struck, etc.)
    const parsedStyle = style ? String(style).toLowerCase().replace(/[-_\s]/g, '') : 'off';

    let result = lowerText;

    if (parsedStyle === 'upsidedown') {
      // Reverse so the text reads correctly when flipped.
      result = lowerText.split('').map(c => upsideDownMap[c] || c).reverse().join('');
    } else if (STYLE_MAPS[parsedStyle]) {
      const map = STYLE_MAPS[parsedStyle];
      result = Array.from(lowerText).map(c => map[c] || c).join('');
    } else if (COMBINING[parsedStyle]) {
      const mark = COMBINING[parsedStyle];
      result = Array.from(lowerText).map(c => (c === ' ' ? c : c + mark)).join('');
    }

    return emoji ? emoji + ' ' + result : result;
  }
};
