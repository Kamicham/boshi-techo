// シミュレーションの家族（すべて作った家族。実在の人物ではない）。
// 「わが家」と本番には入らない。BOSHI_SIM=1 のサーバ（scripts/sim-server.sh）だけが読む。
import type { Family } from "@/lib/demo-family";

export interface Persona {
  /** この家族を一言で（報告の見出し） */
  label: string;
  /** なりきる人（members の id）と、その人の状況・言葉の力 */
  meId: string;
  who: string;
  /** 日本語・漢字・スマホの得意さ（なりきりの Claude が守る） */
  literacy: "ふつう" | "やさしい日本語が要る" | "漢字が苦手" | "スマホが苦手";
  /** 触る日と、その日にやりたい事（なりきりの目的） */
  goals: { on: string; want: string }[];
  /** この家族で特に守れているか見たい事（早送りの検査が読む） */
  watch?: string[];
}

export type SimFamily = Family & { persona: Persona };
