import type {SheetOptions} from './sticker-pdf';

export type StickerLayout=Omit<SheetOptions,'origin'|'test'>;
export const defaultStickerLayout:StickerLayout={width:66.675,height:25.4,marginX:4.7625,marginY:12.7,gapX:3.175,gapY:0,paper:'letter'};
// Avery's U-0313-01 PDF: Letter, 202.5 × 108 pt cells, starting at x=2.25 / top=18 pt.
// https://www.avery.com/templates/5360 (3 columns × 7 rows; no gaps)
export const avery5360Layout:StickerLayout={width:71.4375,height:38.1,marginX:0.79375,marginY:6.35,gapX:0,gapY:0,paper:'letter',identifierBeside:true};
export const stickerPresets={standard:{name:'Standard 30 labels · 2⅝ × 1 inch',layout:defaultStickerLayout},avery5360:{name:'Avery 5360 · 21 labels · 2¹³⁄₁₆ × 1½ inches',layout:avery5360Layout}};
