"use client";

// 世帯を作る（最初の人）。作った人が持ち主になり、本人「母」「子」（生まれる前は仮の名前）と、いればパートナーを作る。
// 作った後は「記録を残す同意」へ進む。氏名ではなく呼び名で十分。
// 字は画面の言葉で出す（t()。辞書は lib/i18n/dict/account.ts）。世帯の名前の既定は、はじめの画面と同じく画面の言葉（わが家・我家・Our family）
import { useState } from "react";
import { api, useFamily } from "@/components/FamilyProvider";
import { Btn, Why } from "@/components/ui";
import { Box, field, Msg } from "@/components/settings/account-ui";
import { t } from "@/lib/i18n";

export default function NewHousehold() {
  const { account, accountsEnabled, reload, setFamilyId } = useFamily();
  const [me, setMe] = useState<"mother" | "partner">("mother");
  const [form, setForm] = useState({ name: t("わが家"), motherName: "", partnerName: "", childName: "" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  if (!accountsEnabled || !account)
    return (
      <main className="flex flex-col gap-4 px-4 pt-6">
        <h1 className="font-display text-2xl font-bold">{t("世帯を作る")}</h1>
        <p className="text-base">{t("先にログインしてください。")}</p>
        <Btn href="/login?next=/account/new">{t("ログイン・アカウントを作る")}</Btn>
      </main>
    );

  const create = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await api<{ householdId: string }>("/api/account/household", { body: { ...form, me } });
      await reload();
      setFamilyId(r.householdId);
      window.location.href = `/account/consent?familyId=${encodeURIComponent(r.householdId)}&next=/settings`;
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
      setBusy(false);
    }
  };

  const pill = (on: boolean) => `min-h-11 rounded-full px-5 text-base font-semibold ${on ? "bg-rose text-white" : "bg-rose-soft text-rose"}`;

  return (
    <main className="flex flex-col gap-4 px-4 pt-4 pb-8">
      <h1 className="font-display text-2xl font-bold">{t("世帯を作る")}</h1>
      <p className="text-base text-muted">{t("世帯は、家族の手帳の入れ物です。あとから家族を招けます。")}</p>

      <Box title={t("あなたは？")}>
        <div className="flex flex-wrap gap-2">
          <button type="button" aria-pressed={me === "mother"} className={pill(me === "mother")} onClick={() => setMe("mother")}>
            {t("ママ（母）")}
          </button>
          <button type="button" aria-pressed={me === "partner"} className={pill(me === "partner")} onClick={() => setMe("partner")}>
            {t("パートナー")}
          </button>
        </div>
      </Box>

      <Box title={t("呼び名")}>
        <label className="flex flex-col gap-1 text-base">
          {t("ママ（母）の呼び名")}
          <input id="mother-name" className={field} value={form.motherName} onChange={(e) => setForm({ ...form, motherName: e.target.value })} placeholder={t("例: はるか")} />
        </label>
        <label className="flex flex-col gap-1 text-base">
          {t("パートナーの呼び名")}
          {me === "mother" && <span className="text-sm text-muted">{t("（いなければ空のまま）")}</span>}
          <input id="partner-name" className={field} value={form.partnerName} onChange={(e) => setForm({ ...form, partnerName: e.target.value })} placeholder={t("例: けんた")} />
        </label>
        <label className="flex flex-col gap-1 text-base">
          {t("赤ちゃんの呼び名")}
          <input id="child-name" className={field} value={form.childName} onChange={(e) => setForm({ ...form, childName: e.target.value })} placeholder={t("おなかの子")} />
        </label>
        <label className="flex flex-col gap-1 text-base">
          {t("世帯の名前（家族だけに見えます）")}
          <input id="household-name" className={field} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </label>
      </Box>

      <Btn onClick={() => void create()} disabled={busy} full>
        {busy ? t("作っています…") : t("世帯を作る")}
      </Btn>
      <Msg msg={msg} />
      <Why label={t("入れた事はどこに？")}>
        <p>{t("この世帯の中だけに置きます。氏名・住所の番地は入れなくて大丈夫です。")}</p>
        <p>{t("写真・録音のファイルは、世帯ごとの鍵で暗号にしてから置きます。")}</p>
      </Why>
    </main>
  );
}
