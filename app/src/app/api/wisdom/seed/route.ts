// デモ用の種（さいたま市・作った例）を入れる。何度呼んでも重複しない。
import { route } from "@/lib/api";
import { SEED_CITY, seedWisdom } from "@/lib/wisdom";

export const POST = route(async () => ({ city: SEED_CITY, ...seedWisdom() }));
