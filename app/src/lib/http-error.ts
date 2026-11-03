// API が日本語の言葉と HTTP の番号を返すための例外。lib/api.ts の route() が JSON に直す。
// 前は lib/family.ts にあった（family.ts は今もここから出し直しているので、どちらから読んでも同じ物）。
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
