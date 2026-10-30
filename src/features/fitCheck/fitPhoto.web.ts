/** The website keeps nothing: a fit check's photo lasts while the page is open. */
export async function keepFitPhoto(uri: string, _name: string): Promise<string> {
  return uri;
}

export function dropFitPhoto(_uri: string) {}
