import { verifyHashedCode, setDatabaseAccessCode, clearDatabaseAccessCode, getDatabase } from './database.js';

// Simple hash function using Web Crypto API
export async function hashCode(code) {
  const encoder = new TextEncoder();
  const data = encoder.encode(code);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

// Session management
let isAuthenticated = false;

export function verifySession() {
  return isAuthenticated;
}

export function setAuthenticated(status) {
  isAuthenticated = status;
}

export async function loginUser(code) {
  try {
    // Hash the provided code
    const hashedCode = await hashCode(code);
    
    // Initialize database with the access code for encryption
    await getDatabase(code);
    
    // Verify against database
    const isValid = await verifyHashedCode(hashedCode);
    
    if (isValid) {
      setAuthenticated(true);
      setDatabaseAccessCode(code); // Store the access code for encryption
      console.log('User authenticated successfully');
      return { success: true };
    } else {
      clearDatabaseAccessCode(); // Clear the access code if authentication fails
      console.log('Invalid access code');
      return { success: false, error: 'Invalid access code' };
    }
  } catch (error) {
    console.error('Error during login:', error);
    clearDatabaseAccessCode(); // Clear the access code on error
    return { success: false, error: 'Login failed' };
  }
}

export function logoutUser() {
  setAuthenticated(false);
  clearDatabaseAccessCode(); // Clear the access code from memory
  console.log('User logged out');
}