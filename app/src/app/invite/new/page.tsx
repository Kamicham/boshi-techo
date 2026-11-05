"use client";

// 家族を招く（世帯の持ち主・共同の管理の人）。役と見せる範囲を一緒に決める。
// 母の記録のどの項目を見せるかは母（本人）が選ぶ。既定は「子の記録だけ」（何も選ばない）。
// リンクは48時間で切れる。開発中はメールを送らないので、出たリンクをLINEなどで手渡しする。
// 字は画面の言葉で出す（t()。辞書は lib/i18n/dict/account.ts）。続柄（RELATIONS）と見せる項目は日本語の値のまま API に送り、出す所で訳す
// 相手に送る文の言葉は、画面の言葉と別に選べる（最初は画面の言葉。11/5 UX）。リンクにもその言葉の印（?lang=zh）を付け、
// 相手が開いた画面もその言葉で開く（app/invite/[id]）。文と題の辞書は dict/invite-share.ts（lib/invite-words.ts の inviteShareTextIn）
import { useEffect, useState } from "react";
import { api, useFamily } from "@/components/FamilyProvider";
import { Btn, CopyButton, ShareButton, Why } from "@/components/ui";
import { Box, field, jpDateTime, Msg, useHouseholdDetail } from "@/components/settings/account-ui";
import { useQuery } from "@/components/settings/ConsentScreen";
import { RELATIONS, SHARE_ITEMS, type Relation, type ShareItem } from "@/components/settings/consent-texts";
import { inviteLinkIn, inviteShareTextIn, inviteShareTitleIn, lineShareUrl } from "@/lib/invite-words";
import { currentLang, HTML_LANG, LANG_NAMES, LANGS, t, type Lang } from "@/lib/i18n";

export default function NewInvite() {
  const { family, households } = useFamily();
  const q = useQuery();
  const familyId = q.ready ? (q.familyId ?? (households.some((h) => h.id === family.id) ? family.id : (households[0]?.id ?? null))) : null;
  const { data, error } = useHouseholdDetail(familyId);
  const [email, setEmail] = useState("");
  // 訳さない: 続柄の値（API に送る。出す時に t() で訳す）
  const [relation, setRelation] = useState<Relation>("パートナー");
  const [show, setShow] = useState<Set<ShareItem>>(new Set());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [made, setMade] = useState<{ link: string; expiresAt: string; email: string } | null>(null);
  // 送る文の言葉（作った時に、画面の言葉で始める）
  const [shareLang, setShareLang] = useState<Lang>("ja");

  // ママとパートナーは共同の管理（記録を足せる）、ほかは読むだけ
  const role = relation === "パートナー" || relation === "ママ" ? "admin" : "member";
  const iAmMother = !!data?.subjects.some((s) => s.kind === "mother" && s.mine);
  const iAmPartner = !!data?.subjects.some((s) => s.kind === "partner" && s.mine);
  // 母の本人にまだだれも結びついていない手帳（パートナーが始めた）では「ママ」を招ける。自分の役は選び肢に出さない
  const motherFree = !!data?.subjects.some((s) => s.kind === "mother" && !s.accountId);
  const choices = RELATIONS.filter((r) => (r === "ママ" ? motherFree && !iAmMother : r === "パートナー" ? !iAmPartner : true));
  const mamaFirst = choices[0] === "ママ";
  useEffect(() => {
    // 訳さない: 続柄の値（API に送る。出す時に t() で訳す）
    if (mamaFirst) setRelation("ママ");
  }, [mamaFirst]);

  const send = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await api<{ link: string; expiresAt: string }>("/api/account/invite", {
        body: { familyId, email, role, relation, showMother: role === "member" ? [...show] : [] },
      });
      setShareLang(currentLang());
      setMade({ link: `${window.location.origin}${r.link}`, expiresAt: r.expiresAt, email: email.trim() });
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  // 相手に送るリンク（言葉の印つき）と文。言葉を選び直すと、両方が変わる
  const link = made ? inviteLinkIn(made.link, shareLang) : "";
  const text = made ? inviteShareTextIn(shareLang, made.email, link) : "";

  if (!familyId) return <main className="px-4 pt-6 text-base">{t("招く世帯がありません。先に世帯を作ってください。")}</main>;

  return (
    <main className="flex flex-col gap-4 px-4 pt-4 pb-10">
      <h1 className="font-display text-2xl font-bold">{t("家族を招く")}</h1>
      {error && <Msg msg={{ ok: false, text: error }} />}

      {made ? (
        <Box title={t("招待のリンクができました")}>
          <p className="text-base">{t("この文を、そのまま相手に送ってください。{date}まで（48時間）使えます。", { date: jpDateTime(made.expiresAt) })}</p>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-base font-semibold">{t("送る文の言葉")}</legend>
            <div className="flex flex-wrap gap-2">
              {LANGS.map((l) => (
                <button
                  key={l}
                  type="button"
                  lang={HTML_LANG[l]}
                  aria-pressed={shareLang === l}
                  onClick={() => setShareLang(l)}
                  className={`min-h-11 rounded-full px-5 text-base font-semibold ${shareLang === l ? "bg-rose text-white" : "bg-rose-soft text-rose"}`}
                >
                  {LANG_NAMES[l]}
                </button>
              ))}
            </div>
            <p className="text-sm text-muted">{t("相手がリンクを開くと、この言葉の画面で開きます（相手は画面の上で変えられます）。")}</p>
          </fieldset>
          <p id="invite-text" lang={HTML_LANG[shareLang]} className="rounded-lg bg-paper px-3 py-2 text-base break-all whitespace-pre-line">
            {text}
          </p>
          <Btn href={lineShareUrl(text)} full>
            {t("LINE で送る")}
          </Btn>
          <div className="flex flex-wrap items-center gap-2">
            <CopyButton text={text} label={t("文をコピー")} />
            <ShareButton title={inviteShareTitleIn(shareLang)} text={text} label={t("ほかのアプリで送る…")} fallback={false} />
          </div>
          <Why label={t("リンクだけを送る時")}>
            <div className="flex items-center justify-between gap-2">
              <span>{t("招待のリンク")}</span>
              <CopyButton text={link} />
            </div>
            <p id="invite-link" className="break-all">
              {link}
            </p>
          </Why>
          <Btn href={`/account?familyId=${encodeURIComponent(familyId)}`} kind="secondary">
            {t("アカウントの画面へ")}
          </Btn>
        </Box>
      ) : (
        <>
          <Box title={t("だれを")}>
            <div className="flex flex-wrap gap-2">
              {choices.map((r) => (
                <button
                  key={r}
                  type="button"
                  aria-pressed={relation === r}
                  onClick={() => setRelation(r)}
                  className={`min-h-11 rounded-full px-5 text-base font-semibold ${relation === r ? "bg-rose text-white" : "bg-rose-soft text-rose"}`}
                >
                  {t(r)}
                </button>
              ))}
            </div>
            <p className="text-sm text-muted">
              {role === "admin"
                ? t("共同の管理: 記録を見て、足して、家族を招けます")
                : t("読むだけ: 子の手帳の記録と写真・声を見られます（手帳のママの頁と健診は見えません。話した記録や一冊などには、今は母の記録も入ります）。足す・直すはできません")}
            </p>
            <label className="flex flex-col gap-1 text-base">
              {t("相手のメール（このメールのコードで入った人だけが受けられます）")}
              <input type="email" inputMode="email" autoComplete="off" className={field} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="family@example.com" />
            </label>
          </Box>

          {role === "member" && (
            <Box title={t("母の記録から、見せる物")}>
              {iAmMother ? (
                <>
                  <p className="text-base">
                    {t(
                      "何も選ばなければ、写真と声は子の分だけを見せます。母の写真を選ぶと、母の写真と声も見せます。母の手帳の頁と健診の記録は、今は見せません（選べるようにする仕組みは準備中です）。話した記録や一冊などには、今は母の記録も入ります。",
                    )}
                  </p>
                  {SHARE_ITEMS.map((it) => {
                    // 母の手帳の頁と健診は、読むだけの人には今は見せない（lib/mother-records.ts・api/visit の notForReaders）。選べても効かないので選べなくする
                    const notYet = it.id !== "photo";
                    return (
                      <label key={it.id} className={`flex min-h-11 items-center gap-3 text-base ${notYet ? "text-muted" : ""}`}>
                        <input
                          type="checkbox"
                          className="size-5 accent-rose"
                          disabled={notYet}
                          checked={!notYet && show.has(it.id)}
                          onChange={(e) => {
                            const n = new Set(show);
                            if (e.target.checked) n.add(it.id);
                            else n.delete(it.id);
                            setShow(n);
                          }}
                        />
                        {t(it.label)}
                        {notYet ? t("（今は見せません）") : ""}
                      </label>
                    );
                  })}
                </>
              ) : (
                <p className="text-base">
                  {t("母の記録を見せる範囲は、母本人が選びます。この招待では、写真と声は子の分だけを見せます（手帳のママの頁と健診は見せません。話した記録や一冊などには、今は母の記録も入ります）。")}
                </p>
              )}
            </Box>
          )}

          <Btn onClick={() => void send()} disabled={busy || !email.trim() || !data} full>
            {busy ? t("作っています…") : t("招待のリンクを作る")}
          </Btn>
          <Msg msg={msg} />
          <Why label={t("なぜメールのコードで受けるの？")}>
            <p>{t("リンクを他の人に転送されても、招待したメールの持ち主でなければ受けられないようにするためです。")}</p>
          </Why>
        </>
      )}
    </main>
  );
}
