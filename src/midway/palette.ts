import { theme } from '../carnival';

const { colors } = theme;

/**
 * The midway map's warcamp palette. Banner reds, bones and brasses come from
 * the carnival theme; the night sky, moss, paths and other scenery shades only
 * the map uses live here.
 */
export const palette = {
  sky: '#24263c',
  skyHigh: '#151726',
  cloud: '#5a5d78',
  cloudShade: '#43465e',
  haze: '#8a4a2a', // campfire glow on the horizon

  grass: '#3e4a1c',
  grassDark: '#34401a',
  grassEdge: '#232b10',
  grassLight: '#4c5a24',
  path: '#a88c60',
  pathShade: '#8e744c',
  hedge: '#141b0c',
  hedgeDark: '#0d1207',
  hedgeLight: '#232e15',
  shadow: 'rgba(8, 6, 3, 0.45)',

  red: colors.stripeA,
  redShade: '#7e1a12',
  cream: colors.stripeB,
  creamShade: '#bfae88',
  gold: colors.accent,
  goldShade: '#a8771a',
  blue: '#7890a0',
  blueShade: '#56707f',
  sky2: colors.water,
  pink: '#a8603e',
  pinkShade: '#7e432a',
  wood: colors.wood,
  woodDark: '#4a2c18',
  woodLight: '#94683c',
  board: '#a08356',
  metal: '#a39a8c',
  metalShade: '#6e665b',
  ink: colors.background,
  opening: '#0e0a07',
  closed: '#6a665c',
  closedShade: '#4f4c44',
  white: '#ffffff',
  outline: 'rgba(14, 10, 6, 0.85)',
  hide: '#a8875a',
  hideShade: '#8a6c45',
  hideDark: '#5e4a30',
  rope: '#9c8a5e',
  scrap: '#7b6a58',
  rust: '#8c4a24',
  fire: '#f5a524',
  fireCore: '#ffe08a',
  ember: '#d8501c',
  torchGlow: 'rgba(245, 165, 36, 0.14)',
  torchGlowCore: 'rgba(255, 200, 90, 0.2)',
  glass: 'rgba(242, 230, 200, 0.35)',
  glassSide: 'rgba(242, 230, 200, 0.45)',
  glassShade: 'rgba(242, 230, 200, 0.3)',

  skins: ['#9fd34f', '#8cc63f', '#b3dc5e', '#7fbf3a', '#a6c94a'],
  hairs: ['#1a1610', '#14110d', '#3b2414', '#2e2a22', '#4a2c18'],
  shirts: [colors.stripeA, '#6b4a2a', '#56707f', colors.danger, '#7a5a3a', colors.stripeB],
  pants: ['#2a1f15', '#3b2e20', '#252a1e'],
  bunting: [colors.stripeA, colors.accent, '#a8875a', '#7890a0'],
  balloons: [colors.accent, '#d8501c', '#f5a524', '#ffe08a', colors.stripeA],
} as const;
