// ログインした人と、その人が見てよい家族の一覧（画面の FamilyProvider が読む）。
// - アカウントの仕組みが動かない置き場（わが家の app/data で BOSHI_ACCOUNTS が無い）では { enabled: false } を返す。
//   画面は今までどおり /api/family を読む（今の動きを変えない）
// - 動く置き場では: その人の世帯（家族の設定を入れた物）＋公開の世帯（デモ・シミュレーションの作った家族）だけを返す
import { route } from "@/lib/api";
import { allFamilies, getFamily } from "@/lib/family";
import { currentAccount, myHouseholds, publicHouseholdKind } from "@/lib/access";
import { getHousehold, listSubjects, activeConsent } from "@/lib/households";
import type { Family } from "@/lib/demo-family";
import { accountsEnabled } from "./_lib/server";
import { CONSENT_VERSION } from "@/components/settings/consent-texts";

export const dynamic = "force-dynamic";

export const GET = route(async (req: Request) => {
  if (!(await accountsEnabled())) return { enabled: false };
  const account = await currentAccount(req);
  const id = new URL(req.url).searchParams.get("id") ?? "";

  const households = account
    ? myHouseholds(account.id).map((h) => {
        const subjects = listSubjects(h.id);
        // はじめの「記録を残す同意」がまだの本人がいるか（画面が同意の画面へ案内する）
        const needsRecordConsent = subjects.some((s) => !activeConsent(h.id, s.id, "record", CONSENT_VERSION.record));
        return { ...h, kind: getHousehold(h.id)?.kind ?? "real", hasProfile: !!getFamily(h.id), needsRecordConsent };
      })
    : [];

  const families: Family[] = [];
  const kinds: Record<string, "real" | "demo" | "sim"> = {};
  for (const h of households) {
    const f = getFamily(h.id);
    if (f) {
      families.push(f);
      kinds[h.id] = h.kind;
    }
  }
  // 公開の世帯: デモ（いつも）とシミュレーションの30家族（BOSHI_SIM=1 の時だけ）。本物の世帯（わが家など）は出さない
  const pub = allFamilies().filter((f) => !kinds[f.id] && publicHouseholdKind(f.id));
  // 1000組（pop-）は一覧に入れず、開いている家族だけを足す
  if (id && !kinds[id] && !pub.some((f) => f.id === id) && publicHouseholdKind(id)) {
    const f = getFamily(id);
    if (f) pub.unshift(f);
  }
  for (const f of pub) {
    families.push(f);
    kinds[f.id] = publicHouseholdKind(f.id) ?? "demo";
  }
  return { enabled: true, account, households, families, kinds };
});
