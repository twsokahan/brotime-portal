import { extractEmails } from './allowlist.mjs';
import { taipeiDate } from './responses.mjs';
import { checkTokenInfo, makeSession, readSession } from './session-token.mjs';

const fail = (error) => ({ ok: false, error });

function listedScope(deps, email) {
  const allowlist = deps.allowlist();
  return Object.hasOwn(allowlist, email) ? allowlist[email] : null;
}

// Returns { email, scope } for a valid session, or { failure } to send back as is.
function callerOf(request, deps, { needsStats = false, needsDistrict = false } = {}) {
  const email = readSession(request.session, deps.now(), deps.sign);
  if (!email) return { failure: fail('bad-session') };
  const scope = listedScope(deps, email);
  if (!needsStats) return { email, scope };
  if (!scope) return { failure: fail('not-listed') };
  if (scope.level === 'none') return { failure: fail('forbidden') };
  if (!needsDistrict) return { email, scope };
  if (typeof request.district !== 'string' || !request.district) return { failure: fail('bad-request') };
  if (!scope.districts.includes(request.district)) return { failure: fail('forbidden') };
  return { email, scope, district: request.district };
}

const newestHostsFirst = (a, b) => (a.addedOn < b.addedOn ? 1 : a.addedOn > b.addedOn ? -1 : 0);

const REQUEST_HANDLERS = {
  signIn(request, deps) {
    if (typeof request.idToken !== 'string' || !request.idToken) return fail('bad-request');
    const email = checkTokenInfo(deps.tokenInfo(request.idToken), deps.clientId, deps.now());
    if (!email) return fail('bad-token');
    const scope = listedScope(deps, email);
    if (!scope) return { ok: true, listed: false, email };
    return { ok: true, listed: true, email, session: makeSession(email, deps.now(), deps.sign), scope };
  },

  me(request, deps) {
    const { failure, email, scope } = callerOf(request, deps);
    if (failure) return failure;
    return scope ? { ok: true, listed: true, email, scope } : { ok: true, listed: false, email };
  },

  stats(request, deps) {
    const { failure, scope } = callerOf(request, deps, { needsStats: true });
    if (failure) return failure;
    return { ok: true, ...deps.stats(scope) };
  },

  hosts(request, deps) {
    const { failure, district } = callerOf(request, deps, { needsStats: true, needsDistrict: true });
    if (failure) return failure;
    const hosts = deps.supplement
      .list()
      .filter((row) => row.district === district)
      .reverse()
      .sort(newestHostsFirst)
      .map(({ email, name, addedOn }) => ({ email, name, addedOn }));
    return { ok: true, hosts };
  },

  addHost(request, deps) {
    const { failure, email: addedBy, district } = callerOf(request, deps, { needsStats: true, needsDistrict: true });
    if (failure) return failure;
    const [email] = extractEmails(request.email);
    if (!email) return fail('bad-email');
    if (listedScope(deps, email)) return { ok: true, added: false, reason: 'already-listed' };
    deps.supplement.add({ email, name: String(request.name ?? '').trim(), district, addedBy, addedOn: taipeiDate(deps.now()) });
    return { ok: true, added: true };
  },

  removeHost(request, deps) {
    const { failure, district } = callerOf(request, deps, { needsStats: true, needsDistrict: true });
    if (failure) return failure;
    const [email] = extractEmails(request.email);
    if (!email) return fail('bad-email');
    return { ok: true, removed: deps.supplement.remove(email, district) };
  },
};

export function handleRequest(request, deps) {
  const action = request?.action;
  if (typeof action !== 'string' || !Object.hasOwn(REQUEST_HANDLERS, action)) return fail('bad-request');
  return REQUEST_HANDLERS[action](request, deps);
}
