declare module "japanese-holidays" {
  function isHoliday(date: Date): string | undefined;
  export default { isHoliday };
}
