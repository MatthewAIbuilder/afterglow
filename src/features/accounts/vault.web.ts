/** The website keeps no passwords: switching asks for one each time. */
export const KEEPS_PASSWORDS = false;
export const readPassword = async (_uid: string): Promise<string | null> => null;
export const savePassword = async (_uid: string, _password: string) => {};
export const forgetPassword = async (_uid: string) => {};
