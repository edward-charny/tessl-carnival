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

  skins: ['#9fd34f', '#8cc63f', '#b3dc5e', '#7fbf3a', '#a6c94a'],
  hairs: ['#1a1610', '#14110d', '#3b2414', '#2e2a22', '#4a2c18'],
  shirts: [colors.stripeA, '#6b4a2a', '#56707f', colors.danger, '#7a5a3a', colors.stripeB],
  pants: ['#2a1f15', '#3b2e20', '#252a1e'],
  bunting: [colors.stripeA, colors.accent, '#7890a0', colors.stripeB],
  balloons: [colors.stripeA, colors.accent, '#7890a0', colors.water, '#a8603e'],
} as const;
