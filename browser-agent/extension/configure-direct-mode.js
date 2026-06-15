/**
 * Configuration Script for Direct Mode
 * Run this in the browser console to configure Gemini API key
 */

// Your Gemini API Key
const GEMINI_API_KEY = 'AIzaSyBCpJhVl_L6cIQ2eBTxvfab-CK8DZsg6ok';

// Save API key to Chrome storage
chrome.storage.local.set({ 
  geminiApiKey: GEMINI_API_KEY,
  directMode: true 
}, () => {
  console.log('✅ Gemini API key configured successfully!');
  console.log('✅ Direct mode activated!');
  console.log('🔄 Please reload the extension to apply changes.');
  console.log('');
  console.log('To verify configuration, run:');
  console.log('chrome.storage.local.get(["geminiApiKey", "directMode"], console.log)');
});

// Made with Bob
