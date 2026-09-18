export type ShareOutcome = 'shared' | 'downloaded' | 'cancelled';

/**
 * Hand a file to the Web Share API where files are supported (the iOS share
 * sheet), otherwise download it. Nothing is ever sent anywhere by us.
 */
export async function shareOrDownload(blob: Blob, name: string, title: string, text?: string): Promise<ShareOutcome> {
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (typeof File !== 'undefined' && nav.canShare && nav.share) {
    const file = blob instanceof File ? blob : new File([blob], name, { type: blob.type });
    if (nav.canShare({ files: [file] })) {
      try {
        await nav.share({ files: [file], title, ...(text ? { text } : {}) });
        return 'shared';
      } catch (e) {
        if ((e as { name?: string }).name === 'AbortError') return 'cancelled';
      }
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return 'downloaded';
}
