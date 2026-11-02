// 作った物を外のアプリへ渡す（メール・LINE・カレンダー・地図・共有シート）。
// どれも「開く」まで。最後に送るのは本人で、このアプリから勝手には送らない。

/** メールアプリを、宛先・件名・本文が入った状態で開く */
export function mailtoUrl(o: { to?: string; subject?: string; body?: string }): string {
  const to = o.to && /@/.test(o.to) ? o.to.trim() : "";
  const q = new URLSearchParams();
  if (o.subject) q.set("subject", o.subject);
  if (o.body) q.set("body", o.body);
  // URLSearchParams は空白を + にするので、メールアプリ向けに %20 へ
  return `mailto:${encodeURIComponent(to)}?${q.toString().replace(/\+/g, "%20")}`;
}

/** LINE を、本文が入った状態で開く（送り先は LINE の中で選ぶ） */
export function lineUrl(text: string): string {
  return `https://line.me/R/share?text=${encodeURIComponent(text)}`;
}

/** Google カレンダーの予定を作る画面を開く（終日 or 時刻つき・日本時間） */
export function googleCalendarUrl(o: { title: string; date: string; time?: string | null; minutes?: number; details?: string; place?: string }): string {
  const d = o.date.replace(/-/g, "");
  let dates: string;
  if (o.time) {
    const [h, m] = o.time.split(":").map(Number);
    const start = new Date(Date.UTC(+o.date.slice(0, 4), +o.date.slice(5, 7) - 1, +o.date.slice(8, 10), h - 9, m));
    const end = new Date(start.getTime() + (o.minutes ?? 60) * 60_000);
    const f = (x: Date) => x.toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";
    dates = `${f(start)}/${f(end)}`;
  } else {
    const next = new Date(Date.UTC(+o.date.slice(0, 4), +o.date.slice(5, 7) - 1, +o.date.slice(8, 10) + 1));
    dates = `${d}/${next.toISOString().slice(0, 10).replace(/-/g, "")}`;
  }
  const q = new URLSearchParams({ action: "TEMPLATE", text: o.title, dates, ctz: "Asia/Tokyo" });
  if (o.details) q.set("details", o.details);
  if (o.place) q.set("location", o.place);
  return `https://calendar.google.com/calendar/render?${q.toString()}`;
}

/** iPhone のカレンダーに入れるための .ics の中身（Blob にして開く） */
export function icsText(o: { title: string; date: string; time?: string | null; minutes?: number; details?: string; place?: string }): string {
  const esc = (s: string) => s.replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\n/g, "\\n");
  const d = o.date.replace(/-/g, "");
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//boshi-techo//JP", "BEGIN:VEVENT", `UID:${d}-${Math.abs(hash(o.title))}@boshi-techo`];
  if (o.time) {
    const t = o.time.replace(":", "") + "00";
    const [h, m] = o.time.split(":").map(Number);
    const endMin = h * 60 + m + (o.minutes ?? 60);
    const et = `${String(Math.floor(endMin / 60) % 24).padStart(2, "0")}${String(endMin % 60).padStart(2, "0")}00`;
    lines.push(`DTSTART;TZID=Asia/Tokyo:${d}T${t}`, `DTEND;TZID=Asia/Tokyo:${d}T${et}`);
  } else {
    lines.push(`DTSTART;VALUE=DATE:${d}`);
  }
  lines.push(`SUMMARY:${esc(o.title)}`);
  if (o.details) lines.push(`DESCRIPTION:${esc(o.details)}`);
  if (o.place) lines.push(`LOCATION:${esc(o.place)}`);
  lines.push("BEGIN:VALARM", "TRIGGER:-P1D", "ACTION:DISPLAY", `DESCRIPTION:${esc(o.title)}`, "END:VALARM", "END:VEVENT", "END:VCALENDAR");
  return lines.join("\r\n");
}

/** 地図アプリで場所を開く（iPhone は Apple マップ、それ以外は Google マップ） */
export function mapUrl(place: string, apple?: boolean): string {
  const isApple = apple ?? isAppleDevice();
  return isApple ? `https://maps.apple.com/?q=${encodeURIComponent(place)}` : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place)}`;
}

/** Apple の端末か（画面では ui.tsx の useDevice を使う。描画の初めはサーバと同じ false にそろえるため） */
export function isAppleDevice(): boolean {
  return typeof navigator !== "undefined" && /iPhone|iPad|Macintosh/.test(navigator.userAgent);
}

/** iPhone の共有シートが使えるか */
export function canShare(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.share === "function";
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}
