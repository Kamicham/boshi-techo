"use client";

// わが家の設定: 予定日・町・家族の呼び名。氏名や住所の番地は入れない。
import { useEffect, useState } from "react";
import { api, useFamily } from "@/components/FamilyProvider";
import type { Family, Member } from "@/lib/demo-family";

const ROLES: Member["role"][] = ["母", "パートナー", "祖父母"];

export default function Settings() {
  const { families, reload, setFamilyId } = useFamily();
  const mine = families.find((f) => f.id === "mine");
  const [form, setForm] = useState({ prefecture: "", city: "", dueDate: "", birthDate: "", childName: "" });
  const [members, setMembers] = useState<Member[]>(ROLES.map((role, i) => ({ id: `m${i}`, name: "", role, voice: "" })));
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (!mine) return;
    setForm({ prefecture: mine.prefecture, city: mine.city, dueDate: mine.dueDate, birthDate: mine.birthDate ?? "", childName: mine.childName ?? "" });
    if (mine.members.length) setMembers(mine.members);
  }, [mine]);

  const save = async () => {
    setMsg(null);
    try {
      await api<{ family: Family }>("/api/family", { body: { ...form, members } });
      await reload();
      setFamilyId("mine");
      setMsg({ ok: true, text: "保存しました。上の切り替えが「わが家」になっています" });
    } catch (e) {
      setMsg({ ok: false, text: `保存できませんでした: ${(e as Error).message}` });
    }
  };

  const field = "w-full rounded-lg border border-line bg-card px-3 py-2";
  return (
    <main className="flex flex-col gap-5 px-4 pt-4">
      <header>
        <h1 className="font-display text-2xl font-bold">わが家の設定</h1>
        <p className="text-sm text-muted">ここに入れた事は、この機械の中だけに置きます。氏名・住所の番地は入れなくて大丈夫です。</p>
      </header>
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm">都道府県<input id="pref" className={field} value={form.prefecture} onChange={(e) => setForm({ ...form, prefecture: e.target.value })} placeholder="埼玉県" /></label>
        <label className="flex flex-col gap-1 text-sm"><span>市区町村 <Req /></span><input id="city" required aria-required className={field} value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="さいたま市" /></label>
        <label className="flex flex-col gap-1 text-sm"><span>出産予定日 <Req /></span><input id="due" type="date" required aria-required className={field} value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} /></label>
        <label className="flex flex-col gap-1 text-sm">生まれた日（まだなら空）<input id="birth" type="date" className={field} value={form.birthDate} onChange={(e) => setForm({ ...form, birthDate: e.target.value })} /></label>
        <label className="col-span-2 flex flex-col gap-1 text-sm">赤ちゃんの呼び名（任意）<input id="child" className={field} value={form.childName} onChange={(e) => setForm({ ...form, childName: e.target.value })} placeholder="おなかの子" /></label>
      </div>
      <section className="flex flex-col gap-3">
        <h2 className="font-display text-lg font-bold">家族（呼び名でよい）</h2>
        {members.map((m, i) => (
          <div key={m.id} className="grid grid-cols-[5rem_1fr] items-center gap-2 text-sm">
            <span className="text-muted">{m.role}</span>
            <input
              id={`member-${i}`}
              className={field}
              value={m.name}
              placeholder={m.role === "祖父母" ? "例: 鹿児島のばあば" : "呼び名"}
              onChange={(e) => setMembers(members.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
            />
            <span />
            <input
              id={`member-voice-${i}`}
              className={`${field} text-sm`}
              value={m.voice}
              placeholder="伝え方のヒント（例: 大きな字で、短く）"
              onChange={(e) => setMembers(members.map((x, j) => (j === i ? { ...x, voice: e.target.value } : x)))}
            />
          </div>
        ))}
      </section>
      <button onClick={save} className="self-start rounded-lg bg-rose px-5 py-2 font-semibold text-white">保存する</button>
      {msg && (
        <p
          role={msg.ok ? "status" : "alert"}
          className={`rounded-lg px-3 py-2 text-sm ${msg.ok ? "bg-ok/10 text-ok" : "bg-alert/10 font-semibold text-alert"}`}
        >
          {msg.text}
        </p>
      )}
    </main>
  );
}

function Req() {
  return <span className="rounded bg-rose-soft px-1.5 py-0.5 text-xs font-semibold text-rose">必須</span>;
}
