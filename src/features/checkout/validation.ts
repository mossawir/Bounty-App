import type { OrderContact } from '@/types/domain';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Client-side mirror of the server's 400 rules. Both run: never trust the client. */
export function validateContact(contact: OrderContact): Record<string, string> {
  const errors: Record<string, string> = {};
  if (contact.name.trim().length < 2) {
    errors['contact.name'] = 'Tell us who the parcel is for (at least 2 characters).';
  }
  if (!EMAIL_PATTERN.test(contact.email.trim())) {
    errors['contact.email'] = 'Enter a valid email address, like you@example.com.';
  }
  return errors;
}

export const CHECKOUT_FIELD_IDS: Record<string, string> = {
  'contact.name': 'contact-name',
  'contact.email': 'contact-email',
};
