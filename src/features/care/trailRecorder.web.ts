import { writeActive } from './trailStore';

/** The website can't record in the background: the trail is a phone-app feature. */
export const TRAIL_TASK = 'afterglow-festival-trail';
export type TrailPermission = 'always' | 'while-open' | 'denied' | 'undetermined';
export const trailPermission = async (): Promise<TrailPermission> => 'denied';
export const askTrailPermission = async (): Promise<TrailPermission> => 'denied';
export const startRecording = async (_festivalId: string, _until: number): Promise<boolean> => false;
export const stopRecording = async (): Promise<void> => {
  await writeActive(undefined);
};
export const isRecording = async (): Promise<boolean> => false;
