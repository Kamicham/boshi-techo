// 辞書: 健診（components/visit/・app/visit/）。書き方は lib/i18n/index.ts の頭。
// 2026-11-05 夕: 次の健診の日の確かめ（結果の画面の1問・健診のタブの添え書き）の字から始めた。健診の画面のほかの字は、UX がこの後に訳して足す。
// 先生の言葉・録音から聞こえた言葉（{said}）は訳さずにそのまま差し込む（機械の聞き取りを、訳でさらに変えない）
import type { Entries } from "..";

export default {
  // ── 結果の画面の1問（components/visit/NextCheck.tsx） ──
  "次の健診・聞こえた日": { zh: "下次检查·听到的日期", en: "Next checkup · the date we heard" },
  "録音からは「{said}」と聞こえました。この日で大丈夫ですか？": {
    zh: "录音里听到的是“{said}”。这个日期对吗？",
    en: "From the recording, we heard “{said}”. Is this date right?",
  },
  "録音からは「{said}」と聞こえました。": { zh: "录音里听到的是“{said}”。", en: "From the recording, we heard “{said}”." },
  "録音からは「{said}」と聞こえましたが、日付にできませんでした。": {
    zh: "录音里听到的是“{said}”，但无法换算成日期。",
    en: "From the recording, we heard “{said}”, but couldn't turn it into a date.",
  },
  大丈夫: { zh: "对的", en: "That's right" },
  言われていない: { zh: "没有说日期", en: "No date was given" },
  この日で大丈夫: { zh: "就是这一天", en: "Use this date" },
  時刻: { zh: "时间", en: "Time" },
  "予約票と見比べてください。": { zh: "请和预约单对照一下。", en: "Please check it against your appointment card." },
  "年をまたいだ日に聞こえました。": { zh: "听到的日期跨到了下一年。", en: "The date we heard falls in the next year." },
  "健診と同じ日に聞こえました。": { zh: "听到的日期和这次检查是同一天。", en: "The date we heard is the same day as this checkup." },
  "言われた曜日と、日付の曜日が違います。": { zh: "说的星期几和日期不一致。", en: "The weekday that was said doesn't match the date." },
  "いつもの間隔より、だいぶ先の日に聞こえました。": {
    zh: "听到的日期比通常的间隔晚很多。",
    en: "The date we heard is much later than the usual interval.",
  },
  "予定日より後の日に聞こえました。": { zh: "听到的日期在预产期之后。", en: "The date we heard is after the due date." },
  "録音から聞こえた日・まだ確かめていません": { zh: "从录音中听到的日期·还没有确认", en: "Date heard from the recording · not checked yet" },
  "{by}が確かめました（{date}）": { zh: "{by}已确认（{date}）", en: "Checked by {by} ({date})" },
  "確かめました（{date}）": { zh: "已确认（{date}）", en: "Checked ({date})" },
  "{by}が直しました（{date}）": { zh: "{by}已修改（{date}）", en: "Changed by {by} ({date})" },
  "直しました（{date}）": { zh: "已修改（{date}）", en: "Changed ({date})" },
  "{by}が確かめました": { zh: "{by}已确认", en: "Checked by {by}" },
  確かめました: { zh: "已确认", en: "Checked" },
  "{by}が直しました": { zh: "{by}已修改", en: "Changed by {by}" },
  直しました: { zh: "已修改", en: "Changed" },
  録音から聞こえた言葉: { zh: "录音中听到的话", en: "Words heard in the recording" },
  "録音から聞こえた言葉:「{said}」": { zh: "录音中听到的话：“{said}”", en: "Words heard in the recording: “{said}”" },
  健診の予約: { zh: "检查预约", en: "Checkup appointment" },
  "次の健診の日は、言われていない事にしました": { zh: "已记为没有说下次检查的日期", en: "Marked as: no date was given for the next checkup" },
  日付を入れる: { zh: "填写日期", en: "Enter a date" },
  "前にカレンダーへ入れていたら、前の予定はカレンダーで消してください": {
    zh: "如果之前已加入日历，请在日历里删除之前的日程",
    en: "If you already added it to your calendar, please delete the old event there",
  },
  "確かめは、まだ手帳に入っていません。もう一度押してください。": {
    zh: "确认还没有记进手册。请再按一次。",
    en: "Your answer isn't in the handbook yet. Please tap again.",
  },

  // ── 結果の画面のほかの直し（components/visit/Results.tsx） ──
  聞こえた数字: { zh: "听到的数字", en: "Numbers we heard" },
  "録音から聞こえた言葉と並べています。数字は機械が聞き取った物で、紙の手帳（先生が書いた欄）が正です。良い・悪いは書きません。気になる時は先生に聞いてください。": {
    zh: "这里和录音中听到的话并列显示。数字是机器听写的，以纸质手册（医生填写的栏目）为准。不评价好坏。有疑问时请问医生。",
    en: "Shown next to the words heard in the recording. The numbers were transcribed by a machine; the paper handbook (where the doctor writes) is what counts. We don't say whether they're good or bad. If anything worries you, ask your doctor.",
  },

  // ── 家族に送る段と健診のタブ（app/visit/[id]/page.tsx・app/visit/page.tsx・components/visit/Briefing.tsx） ──
  "次の健診の日を確かめると、送る文にも入ります": {
    zh: "确认下次检查的日期后，它也会写进要发送的消息里",
    en: "Once you check the next checkup date, it will be included in the message",
  },
  確かめる: { zh: "去确认", en: "Check it" },
  "聞こえた「{said}」": { zh: "听到的：“{said}”", en: "Heard: “{said}”" },
  "聞こえた日・確かめ待ち": { zh: "听到的日期·待确认", en: "Heard date · to check" },
} satisfies Entries;
