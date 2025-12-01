export async function fetchWithRedirects(targetUrl, options, maxRedirects = 3) {
  let currentUrl = targetUrl;
  let redirects = 0;

  while (redirects <= maxRedirects) {
    const response = await fetch(currentUrl, {
      ...options,
      redirect: 'manual'
    });

    const location = response.headers.get('location');
    const isRedirect = response.status >= 300 && response.status < 400 && location;

    if (!isRedirect) {
      return { response, finalUrl: currentUrl, redirects };
    }

    redirects += 1;
    currentUrl = new URL(location, currentUrl).toString();
  }

  // Return last response even if redirect limit exceeded
  const response = await fetch(currentUrl, {
    ...options,
    redirect: 'manual'
  });
  return { response, finalUrl: currentUrl, redirects };
}
