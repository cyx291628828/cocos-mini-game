import { Color } from 'cc';

/** 设计分辨率（竖屏，FIXED_WIDTH 适配） */
export const DW = 750;
export const DH = 1620;

/** 糖果风调色板（与原型一致） */
export const C = {
    ink: '#5B4030',
    inkSoft: '#8A6A4F',
    panel: '#FFFDF6',
    panelLine: '#EBD9AE',
    panelDark: '#E3CB8E',
    cream1: '#FFF6DF',
    cream2: '#FBE3B0',
    greenH: '#8FDD6F', green: '#72CC55', greenD: '#48992F',
    blueH: '#7CC2F5', blue: '#57ABEF', blueD: '#2F7FC0',
    purpleH: '#BC94F7', purple: '#A06FF2', purpleD: '#7744C9',
    pinkH: '#FFA5C6', pink: '#FF7FB2', pinkD: '#E04E86',
    goldH: '#FFE083', gold: '#FFC93C', goldD: '#E19A00',
    red: '#E86A6A', redD: '#C04545',
    gray: '#CFC8B8', grayD: '#948C7C',
};

/** '#RRGGBB' 或 '#RRGGBBAA' -> Color */
export function hex(s: string, a = 255): Color {
    const c = new Color();
    c.fromHEX(s);
    c.a = a;
    return c;
}
