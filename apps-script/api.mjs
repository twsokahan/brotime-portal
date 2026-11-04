import { canonicalEmail } from './allowlist.mjs';
import { hasKey } from './districts.mjs';
import { checkTokenInfo, makeSession, readSession } from './session-token.mjs';

const fail = (error) => ({ ok: false, error });

function listedScope(deps, email) {
  const allowlist = deps.allowlist();
  const key = canonicalEmail(email);
  return hasKey(allowlist, key) ? allowlist[key] : null;
}

// Returns { email, scope } for a valid session, or { failure } to send back as is.
function callerOf(request, deps, { needsStats = false } = {}) {
  const email = readSession(request.session, deps.now(), deps.sign);
  if (!email) return { failure: fail('bad-session') };
  const scope = listedScope(deps, email);
  if (needsStats && !scope) return { failure: fail('not-listed') };
  return { email, scope };
}

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
};

export function handleRequest(request, deps) {
  const action = request?.action;
  if (typeof action !== 'string' || !hasKey(REQUEST_HANDLERS, action)) return fail('bad-request');
  return REQUEST_HANDLERS[action](request, deps);
}
