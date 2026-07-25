/**
 * Vite entry point. Import order is load-bearing: app.js registers its own
 * DOMContentLoaded handler and today.js registers a second one, and the app
 * handler must run first because it is what hydrates progress and populates
 * CAPTURE_STATE before Today renders against it.
 */
import './style.css';
import './app.js';
import './today.js';
