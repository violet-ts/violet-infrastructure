// 文字数制限を表現する文字列型
// operate env 環境をテストするのは用意ではないためこのようにした
// RangedString<'---'> で例えば 3 文字以下の文字列
// 定数であれば assertRangedString('abc') のようにして RangedString<'---'> の型をもつ文字列を生成できる
// util と組み合わせて、 assertInRange(concat(this.prefix, assertRangedString('-mysql')), len26) のようにすることで、
// 合計文字数が 26 文字以下であることを表し、そうでない場合には unknown となり、型エラーになる。
// 以下は実行時の検査を一切しない。 Terraform の実行時には本来の文字が入っているとは限らない、といった都合や、簡単さのため。

/* eslint-disable @typescript-eslint/no-unsafe-return,@typescript-eslint/no-explicit-any,@typescript-eslint/no-unused-vars */
export type RangedString<T extends string> = Record<T, true> & string;

export type ReplaceWithMarks<T extends string> = T extends `${infer _U}${infer V}` ? `-${ReplaceWithMarks<V>}` : '';

export const concat = <T extends string, U extends string>(
  lhs: RangedString<T>,
  rhs: RangedString<U>,
): RangedString<`${T}${U}`> => (lhs + rhs) as any;

export const assertInRange = <T extends string, U extends string>(
  lhs: RangedString<T>,
  _rhs: RangedString<U>,
): U extends `${T}${infer _V}` ? RangedString<U> : unknown => lhs as any;

export const assertRangedString = <T extends string>(v: T): RangedString<ReplaceWithMarks<T>> => v as any;
/* eslint-enable @typescript-eslint/no-unsafe-return,@typescript-eslint/no-explicit-any,@typescript-eslint/no-unused-vars */
