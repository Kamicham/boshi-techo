// 録音中かどうかを全画面で共有する（録音中はタブで別の画面へ移れないようにするため）。
"use client";

let busy = false;
const listeners = new Set<() => void>();

export function setRecordingBusy(v: boolean) {
  if (busy === v) return;
  busy = v;
  listeners.forEach((l) => l());
}

export function subscribeRecording(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

export const recordingBusy = () => busy;
export const recordingBusyServer = () => false;
