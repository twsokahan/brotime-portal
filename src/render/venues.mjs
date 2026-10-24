import { placeMapsUrl, placesByRegion, venueLabel } from '../lib/venues.mjs';
import { escapeHtml } from './html.mjs';

const NO_CITY_WALK = '開車 15 分鐘內沒有城市散步路線。';

const list = (items, renderItem) => items.map(renderItem).join('');

function renderOptions(places) {
  return list(
    placesByRegion(places),
    ({ region, places: inRegion }) =>
      `<optgroup label="${escapeHtml(region)}">${list(
        inRegion,
        (place) => `<option value="${escapeHtml(place.id)}">${escapeHtml(venueLabel(place))}</option>`,
      )}</optgroup>`,
  );
}

const renderSpot = ({ name, what, hours, distance, why, mapsUrl }) =>
  `<li><p class="spot-name"><a href="${escapeHtml(mapsUrl)}">${escapeHtml(name)}</a><span>${escapeHtml(distance)}</span></p>` +
  `<p>${escapeHtml(what)}</p><p>營業：${escapeHtml(hours)}</p>${why ? `<p>${escapeHtml(why)}</p>` : ''}</li>`;

function renderSpots(title, spots) {
  if (!spots.length) return '';
  return `<h4>${title}</h4><ul class="spots">${list(spots, renderSpot)}</ul>`;
}

function renderCityWalks(cityWalks, rel) {
  const items = cityWalks.length
    ? list(cityWalks, ({ text, cityWalkRoute }) => {
        const routeUrl = `${rel}a/city-walk/?d=${encodeURIComponent(cityWalkRoute)}`;
        return `<li>${escapeHtml(text)} <a href="${escapeHtml(routeUrl)}">看路線</a></li>`;
      })
    : `<li>${NO_CITY_WALK}</li>`;
  return `<h4>城市散步</h4><ul class="venue-notes">${items}</ul>`;
}

function renderNotes(notes) {
  if (!notes?.length) return '';
  return `<h4>出發前留意</h4><ul class="venue-notes">${list(notes, (note) => `<li>${escapeHtml(note)}</li>`)}</ul>`;
}

const renderPlace = (place, rel) => `<div class="venue box" id="venue-${escapeHtml(place.id)}" data-venue="${escapeHtml(place.id)}" hidden>
<h3>${escapeHtml(venueLabel(place))}</h3>
<p>${escapeHtml(place.address)} <a href="${escapeHtml(placeMapsUrl(place))}">地圖</a></p>
<p>交通：${escapeHtml(place.transit)}</p>
${renderSpots('吃飯喝咖啡', place.food)}${renderSpots('順路走走', place.walks)}${renderCityWalks(place.cityWalks, rel)}${renderNotes(place.notes)}
</div>`;

export function renderVenues(venues, rel) {
  if (!venues) return '';
  const intro = list(venues.intro, (text) => `<p>${escapeHtml(text)}</p>`);
  const { text, url } = venues.link;
  return `<section class="venues">
<h2>${escapeHtml(venues.title)}</h2>
<select id="venue" aria-label="${escapeHtml(venues.title)}"><option value="" disabled selected>${escapeHtml(venues.prompt)}</option>${renderOptions(venues.places)}</select>
${list(venues.places, (place) => renderPlace(place, rel))}
<div class="venues-intro">${intro}<p><a href="${escapeHtml(url)}">${escapeHtml(text)}</a></p></div>
</section>`;
}
