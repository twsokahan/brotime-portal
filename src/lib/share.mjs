export function cardPageUrl(site, activityId, cardId) {
  return `${site.baseUrl}a/${activityId}/cards/${cardId}/`;
}

export function shareFallbacks(title, url) {
  const copyText = `${title} ${url}`;
  return { lineUrl: 'https://line.me/R/share?text=' + encodeURIComponent(copyText), copyText };
}

export function surveyUrl(survey, activityName) {
  return `${survey.url}?usp=pp_url&${survey.activityEntry}=${encodeURIComponent(activityName)}`;
}
