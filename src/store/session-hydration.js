async function hydrateSession({
  readToken,
  fetchUser,
  clearToken,
  setApiToken,
  isUnauthorized,
  describeError,
  setState,
}) {
  let token;
  try {
    token = await readToken();
  } catch (error) {
    setState({
      ready: true,
      sessionError: `Could not read the saved session: ${describeError(error)}`,
    });
    return;
  }

  if (!token) {
    setState({ ready: true, sessionError: null });
    return;
  }

  setApiToken(token);
  try {
    setState({ user: await fetchUser(), ready: true, sessionError: null });
  } catch (error) {
    setApiToken(null);
    if (!isUnauthorized(error)) {
      setState({
        user: null,
        ready: true,
        sessionError: `Could not verify the saved session: ${describeError(error)}. Your saved session has not been deleted.`,
      });
      return;
    }

    try {
      await clearToken();
    } catch (clearError) {
      setState({
        user: null,
        ready: true,
        sessionError: `The saved session expired but could not be cleared: ${describeError(clearError)}`,
      });
      return;
    }

    setState({ user: null, ready: true, sessionError: null });
  }
}

module.exports = { hydrateSession };
