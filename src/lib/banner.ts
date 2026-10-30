// Name banner letterforms (own drawing): 5-row full blocks wide, 2-row half blocks narrow.
// Shared by the TUI home screen and the phone site's hero.
// ponytail: only the letters of his name are drawn; add glyphs if the name changes.
export const BANNER_BIG: Record<string, string[]> = {
  A: [" █████ ", "██   ██", "███████", "██   ██", "██   ██"],
  R: ["██████ ", "██   ██", "██████ ", "██   ██", "██   ██"],
  H: ["██   ██", "██   ██", "███████", "██   ██", "██   ██"],
  N: ["███   ██", "████  ██", "██ ██ ██", "██  ████", "██   ███"],
  S: [" ██████", "██     ", " █████ ", "     ██", "██████ "],
  J: ["     ██", "     ██", "     ██", "██   ██", " █████ "],
  I: ["██", "██", "██", "██", "██"],
  G: [" ██████ ", "██      ", "██   ███", "██    ██", " ██████ "],
  " ": ["  ", "  ", "  ", "  ", "  "],
};
export const BANNER_SMALL: Record<string, string[]> = {
  A: ["▄▀█", "█▀█"], R: ["█▀█", "█▀▄"], H: ["█ █", "█▀█"], N: ["█▄ █", "█ ▀█"], S: ["█▀▀", "▄██"],
  J: ["  █", "█▄█"], I: ["█", "█"], G: ["█▀▀", "█▄█"], " ": ["  ", "  "],
};
export const BANNER_SHADE = ["#e9ece9", "#d6ddd8", "#c2ccc6", "#adbab3", "#98a89f"];
// one block of rows per banner line: a name wider than `w` breaks between words
export function banner(name: string, big: boolean, w: number): string[][] {
  const font = big ? BANNER_BIG : BANNER_SMALL;
  const draw = (text: string) => {
    const rows = font[" "].map(() => "");
    for (const ch of text.toUpperCase()) {
      const g = font[ch] ?? font[" "];
      for (let r = 0; r < rows.length; r += 1) rows[r] += `${g[r]} `;
    }
    return rows;
  };
  const lines: string[][] = [];
  let cur = "";
  for (const word of name.split(" ")) {
    const next = cur ? `${cur} ${word}` : word;
    if (cur && draw(next)[0].trimEnd().length > w) {
      lines.push(draw(cur));
      cur = word;
    } else cur = next;
  }
  lines.push(draw(cur));
  return lines;
}
// banner lines stack with one blank row between them
export const bannerRows = (lines: string[][]) => lines.reduce((a, l) => a + l.length, 0) + lines.length - 1;
