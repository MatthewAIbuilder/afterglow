/** On the website the picked file is sent as it is: nothing is kept. */
export async function keepCrewPhoto(uri: string): Promise<string> {
  return uri;
}

export function forgetCrewPhoto(_uri: string | undefined) {}
