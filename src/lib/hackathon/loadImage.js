const cache = {};

export async function loadImageDataUrl(url) {
  if (cache[url]) return cache[url];
  const blob = await (await fetch(url)).blob();
  cache[url] = await new Promise((resolve) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.readAsDataURL(blob);
  });
  return cache[url];
}