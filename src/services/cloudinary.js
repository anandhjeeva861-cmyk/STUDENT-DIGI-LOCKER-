const CLOUDINARY_UPLOAD_URL = (cloudName) =>
  `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`;

const ALLOWED_FILE_TYPES = ['application/pdf', 'image/png', 'image/jpeg'];
const ALLOWED_FILE_EXTENSIONS = ['pdf', 'png', 'jpg', 'jpeg'];
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

function cloudinaryConfig() {
  const cloudName = String(import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || '').trim();
  const uploadPreset = String(import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || '').trim();
  if (!cloudName || !uploadPreset) {
    throw new Error('Cloudinary is not configured. Set VITE_CLOUDINARY_CLOUD_NAME and VITE_CLOUDINARY_UPLOAD_PRESET.');
  }
  return { cloudName, uploadPreset };
}

export function validateCloudinaryFile(file) {
  if (!file) return 'Please select a file.';
  const extension = String(file.name || '').split('.').pop()?.toLowerCase();
  if (!ALLOWED_FILE_TYPES.includes(file.type) || !ALLOWED_FILE_EXTENSIONS.includes(extension)) {
    return 'Only PDF, PNG, JPG, and JPEG files are allowed.';
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return 'File size must be 5 MB or smaller.';
  }
  return '';
}

export async function uploadDocument(file) {
  const validationError = validateCloudinaryFile(file);
  if (validationError) throw new Error(validationError);

  const { cloudName, uploadPreset } = cloudinaryConfig();
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', uploadPreset);

  let response;
  try {
    response = await fetch(CLOUDINARY_UPLOAD_URL(cloudName), {
      method: 'POST',
      body: formData,
    });
  } catch (error) {
    throw new Error(`Cloudinary upload failed. Please check your network connection. ${error?.message || ''}`.trim());
  }

  let result = null;
  try {
    result = await response.json();
  } catch {
    result = null;
  }

  if (!response.ok) {
    throw new Error(result?.error?.message || 'Cloudinary upload failed. Please try again.');
  }

  if (!result?.secure_url || !result?.public_id) {
    throw new Error('Cloudinary upload succeeded, but the response did not include a document URL.');
  }

  return {
    secure_url: result.secure_url,
    public_id: result.public_id,
    original_filename: result.original_filename || file.name,
    format: result.format || '',
    bytes: result.bytes || file.size,
  };
}
