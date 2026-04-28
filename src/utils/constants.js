export const PAIRS = ['ES', 'NQ', 'MES', 'MNQ', 'Forex', 'Gold', 'Oil', 'BTC', 'Custom']

export const CONFLUENCES = {
  reversal: {
    label: 'Reversal',
    items: ['Liquidity Sweep'],
  },
  confirmation: {
    label: 'Confirmation',
    items: ['BOS', 'IFVG', 'SMT'],
  },
  continuation: {
    label: 'Continuation',
    items: ['FVG', 'EQ', 'OB', 'BB'],
  },
}

export const ALL_CONFLUENCES = [
  'Liquidity Sweep',
  'BOS',
  'IFVG',
  'SMT',
  'FVG',
  'EQ',
  'OB',
  'BB',
]

export const CONFLUENCE_TYPE = {
  'Liquidity Sweep': 'reversal',
  BOS: 'confirmation',
  IFVG: 'confirmation',
  SMT: 'confirmation',
  FVG: 'continuation',
  EQ: 'continuation',
  OB: 'continuation',
  BB: 'continuation',
}

export const MACRO_WINDOWS = [
  { label: 'Macro 1', start: '09:50', end: '10:10' },
  { label: 'Macro 2', start: '11:00', end: '11:20' },
  { label: 'Macro 3', start: '13:00', end: '13:20' },
  { label: 'Macro 4', start: '15:00', end: '15:20' },
]

export const ADMIN_EMAIL = 'sellerlw30@gmail.com'

export function detectMacroWindow(timeStr) {
  if (!timeStr) return null
  const [h, m] = timeStr.split(':').map(Number)
  const mins = h * 60 + m
  for (const w of MACRO_WINDOWS) {
    const [sh, sm] = w.start.split(':').map(Number)
    const [eh, em] = w.end.split(':').map(Number)
    if (mins >= sh * 60 + sm && mins <= eh * 60 + em) return w.label
  }
  return null
}
