// 体験版（公開版・BOSHI_PUBLIC=1）の言葉（2026-11-05 作り手の決め「ハッカソンの間は API を使わない前提で、だれでも触れる場所」）。
// 体験版は Claude の鍵を入れず、鍵がうっかり入っていても Claude を呼ばない（lib/claude.ts の claude()・sampleMode）。
// 画面とサーバの両方が読む（server-only にしない）。画面は NEXT_PUBLIC_BOSHI_PUBLIC、サーバは BOSHI_PUBLIC で体験版かを見る。

/** 画面が体験版として組まれたか（組み立てる時に入る＝Dockerfile） */
export const PUBLIC_UI = process.env.NEXT_PUBLIC_BOSHI_PUBLIC === "1";

/** 上の帯と入口の1枚: 何を触っているか */
export const TRIAL_BANNER = "体験版です。家族はすべて作った家族で、今は AI（Claude）を呼ばず、前に Claude が書いた一冊と見本の答えで動いています";

/** 見本の答えの断り書き（体験版） */
export const TRIAL_SAMPLE_WHY = "この体験版では Claude を呼ばず、見本の答えを出しています。";

/** 入口の約束（体の判断をしない＝ビジョン⑤「橋」・残す物） */
export const TRIAL_BODY = "体の判断はしません。気になる事は、産院・小児科・#8000（子どもの医療電話相談）へ。";
export const TRIAL_KEEP = "開いた端末の住所（IP）を、写しと一緒に7日まで残します（使い過ぎを止めるため）。";

/** Claude を呼ぶ所に来た時の断り（503） */
export const TRIAL_NO_CLAUDE = "この体験版では AI（Claude）を呼びません。見本の答えがある所は見本で動きます。予定表・期限・急ぎの時・手で入れる記録は、そのまま使えます。";
/** 映画の動画（mp4）の書き出しは、体験版では閉じる（小さな機械で重い組み立てをしない）。映画そのものは画面で見られる */
export const TRIAL_FILM_CLOSED = "体験版では、動画（mp4）の書き出しは閉じています。映画は、上の「映画で見る」からそのまま見られます。";
