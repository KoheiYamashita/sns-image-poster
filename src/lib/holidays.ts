/**
 * 祝日判定ユーティリティ
 *
 * 日本の祝日を判定し、分析時に除外するためのフラグを付与する。
 * エンゲージメントは祝日にブレるため、分析データから除外する。
 */

import JapaneseHolidays from "japanese-holidays";

/**
 * 指定した日付が日本の祝日かどうかを判定
 * @param date 判定する日付
 * @returns 祝日の場合true
 */
export function isJapaneseHoliday(date: Date): boolean {
  return JapaneseHolidays.isHoliday(date) !== undefined;
}

/**
 * 指定した日付の祝日名を取得
 * @param date 判定する日付
 * @returns 祝日名（祝日でない場合はundefined）
 */
export function getHolidayName(date: Date): string | undefined {
  return JapaneseHolidays.isHoliday(date);
}
