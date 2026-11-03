// Same names and order as DISTRICTS in the survey forms script, so survey answers match character for character.
export const DISTRICTS = [
  '花蓮區', '台東區', '蘭陽北區', '蘭陽南區', '基隆北區', '基隆東區', '淡水區', '北投區',
  '士林區', '汐止區', '內湖區', '台北東區', '台北中區', '台北西區', '市府區', '北南一區',
  '北南二區', '三重區', '蘆洲區', '新莊區', '泰林區', '永和區', '中和區', '板橋區',
  '城林區', '桃園北區', '桃園西區', '桃園東區', '桃園中區', '新竹區', '竹縣區', '苗栗區',
  '台中北區', '台中西區', '台中中區', '台中南區', '彰化一區', '彰化二區', '南投區', '雲林一區',
  '雲林二區', '嘉義一區', '嘉義二區', '台南北區', '台南中區', '台南東區', '台南南區', '岡山區',
  '高雄北區', '高雄中區', '高雄西區', '高雄南區', '高港區', '高雄東區', '鳳山區', '寶發區',
  '屏東一區', '屏東二區', '馬祖（基宜圈）', '金門（總合本部）', '澎湖（南二圈）',
];

// How the cadre list abbreviates districts; checkSetup() lists any it cannot place.
export const DISTRICT_ABBREVIATIONS = {
  北東: '台北東區',
  高北: '高雄北區',
};

export const hasKey = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

export function normalizePlace(text) {
  return String(text ?? '').replace(/\s+/g, '');
}

const withoutSuffix = (name, suffix) => (name.endsWith(suffix) ? name.slice(0, -suffix.length) : name);
const islandShortName = (district) => district.split('（')[0];

export function resolveDistrict(text) {
  const place = normalizePlace(text);
  if (!place) return null;
  const match = DISTRICTS.find(
    (district) => district === place || withoutSuffix(district, '區') === place || islandShortName(district) === place,
  );
  if (match) return match;
  return hasKey(DISTRICT_ABBREVIATIONS, place) ? DISTRICT_ABBREVIATIONS[place] : null;
}

export function resolveCircle(text, circles) {
  const place = withoutSuffix(normalizePlace(text), '圈');
  if (!place) return null;
  return Object.keys(circles).find((circle) => withoutSuffix(circle, '圈') === place) ?? null;
}
