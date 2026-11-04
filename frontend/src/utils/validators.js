import { ACCEPTED_IMAGE_TYPES, MAX_IMAGE_SIZE_MB } from './constants';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+?\d{10,15}$/;

// Returns `{ valid, message }`.
export function validateEmail(email) {
  const value = typeof email === 'string' ? email.trim() : '';
  if (!value) return { valid: false, message: 'Email is required' };
  if (!EMAIL_RE.test(value)) return { valid: false, message: 'Enter a valid email address' };
  return { valid: true, message: '' };
}

// Minimum 6 characters.
export function validatePassword(password) {
  const value = typeof password === 'string' ? password : '';
  if (!value) return { valid: false, message: 'Password is required' };
  if (value.length < 6) return { valid: false, message: 'Password must be at least 6 characters' };
  return { valid: true, message: '' };
}

// 10-15 digits, optional leading '+'. Spaces and dashes are ignored.
export function validatePhone(phone) {
  const value = typeof phone === 'string' ? phone.replace(/[\s-]/g, '') : '';
  if (!value) return { valid: false, message: 'Phone number is required' };
  if (!PHONE_RE.test(value)) {
    return { valid: false, message: 'Enter a valid phone number (10-15 digits)' };
  }
  return { valid: true, message: '' };
}

// Generic required-field check.
export function validateRequired(value, label = 'This field') {
  const empty =
    value === null || value === undefined || (typeof value === 'string' && value.trim() === '');
  if (empty) return { valid: false, message: `${label} is required` };
  return { valid: true, message: '' };
}

// Ensures the file is an accepted image within the size limit.
export function validateImageFile(file) {
  if (!file) return { valid: false, message: 'Please select an image' };
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
    return { valid: false, message: 'Only JPG, PNG or WEBP images are allowed' };
  }
  if (file.size > MAX_IMAGE_SIZE_MB * 1024 * 1024) {
    return { valid: false, message: `Image must be smaller than ${MAX_IMAGE_SIZE_MB} MB` };
  }
  return { valid: true, message: '' };
}

// Validate the full "submit complaint" form. Returns `{ valid, errors }`.
export function validateComplaintForm({ wasteType, description, location, file } = {}) {
  const errors = {};

  const wasteCheck = validateRequired(wasteType, 'Waste type');
  if (!wasteCheck.valid) errors.wasteType = wasteCheck.message;

  const descCheck = validateRequired(description, 'Description');
  if (!descCheck.valid) {
    errors.description = descCheck.message;
  } else if (String(description).trim().length < 10) {
    errors.description = 'Description must be at least 10 characters';
  }

  const areaCheck = validateRequired(location?.area, 'Area / zone');
  if (!areaCheck.valid) errors.area = areaCheck.message;

  const addressCheck = validateRequired(location?.address, 'Address');
  if (!addressCheck.valid) errors.address = addressCheck.message;

  const lat = location?.latitude;
  const lng = location?.longitude;
  if (lat === undefined || lat === null || Number.isNaN(Number(lat))) {
    errors.latitude = 'Pick a location on the map';
  }
  if (lng === undefined || lng === null || Number.isNaN(Number(lng))) {
    errors.longitude = 'Pick a location on the map';
  }

  const imageCheck = validateImageFile(file);
  if (!imageCheck.valid) errors.image = imageCheck.message;

  return { valid: Object.keys(errors).length === 0, errors };
}

// Validate account registration. Returns `{ valid, errors }`.
export function validateRegisterForm({
  name,
  email,
  phone,
  password,
  confirmPassword,
  role
} = {}) {
  const errors = {};

  const nameCheck = validateRequired(name, 'Full name');
  if (!nameCheck.valid) errors.name = nameCheck.message;

  const emailCheck = validateEmail(email);
  if (!emailCheck.valid) errors.email = emailCheck.message;

  const phoneCheck = validatePhone(phone);
  if (!phoneCheck.valid) errors.phone = phoneCheck.message;

  const passwordCheck = validatePassword(password);
  if (!passwordCheck.valid) errors.password = passwordCheck.message;

  if (!confirmPassword) {
    errors.confirmPassword = 'Please confirm your password';
  } else if (confirmPassword !== password) {
    errors.confirmPassword = 'Passwords do not match';
  }

  const roleCheck = validateRequired(role, 'Role');
  if (!roleCheck.valid) errors.role = roleCheck.message;

  return { valid: Object.keys(errors).length === 0, errors };
}

// Validate login credentials. Returns `{ valid, errors }`.
export function validateLoginForm({ email, password } = {}) {
  const errors = {};

  const emailCheck = validateEmail(email);
  if (!emailCheck.valid) errors.email = emailCheck.message;

  const passwordCheck = validatePassword(password);
  if (!passwordCheck.valid) errors.password = passwordCheck.message;

  return { valid: Object.keys(errors).length === 0, errors };
}
