/** Company / org brand logo upload rules: PNG or JPG only, max 5 MB. */

export const LOGO_MAX_BYTES = 5 * 1024 * 1024;
export const LOGO_ACCEPT = 'image/png,image/jpeg';

export function validateLogoFile(file) {
  if (!file) return 'Please select a logo file.';
  const type = String(file.type || '').toLowerCase();
  const name = String(file.name || '').toLowerCase();
  const okType =
    type === 'image/png' ||
    type === 'image/jpeg' ||
    name.endsWith('.png') ||
    name.endsWith('.jpg') ||
    name.endsWith('.jpeg');
  if (!okType) return 'Logo must be a PNG or JPG file.';
  if (file.size > LOGO_MAX_BYTES) return 'Logo must be 5 MB or smaller.';
  return '';
}

export function readLogoFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const err = validateLogoFile(file);
    if (err) {
      reject(new Error(err));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Could not read logo file.'));
    reader.readAsDataURL(file);
  });
}
