"use client";

// 下書きが同意の前で断られた時の1行（見直し C38 の「いま」の分）。言葉と行き先は consent-line.ts。
// 押すと同意の画面へ。読んで決めて戻ると、今の画面で手帳がそのまま作る（同意を取らずに作らない）。
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { readConsentState } from "@/lib/claude-consent-flow";
import { api } from "../FamilyProvider";
import { consentHref, consentLine } from "./consent-line";

export function PrepConsent({ familyId, noun }: { familyId: string; noun: string }) {
  const here = usePathname();
  // まだ手帳に入っていないママの分が要るか（GET /api/account/consent。読めない時は同意の画面へ）
  const [mother, setMother] = useState(false);
  useEffect(() => {
    let off = false;
    api<unknown>(`/api/account/consent?familyId=${encodeURIComponent(familyId)}`).then(
      (j) => !off && setMother(readConsentState(j) === "mother"),
      () => {},
    );
    return () => {
      off = true;
    };
  }, [familyId]);
  return (
    <Link href={consentHref(familyId, mother, here || "/")} className="flex min-h-11 w-full items-center gap-2 rounded-xl bg-sky-soft px-3 py-2 text-base text-ink">
      <span className="min-w-0">{consentLine(noun, mother)}</span>
      <span aria-hidden className="ml-auto shrink-0 text-muted">
        ›
      </span>
    </Link>
  );
}
