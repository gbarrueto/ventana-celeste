import { mount } from 'svelte';
import { initDebugLog } from '../lib/debug-log.js';
import './styles/tokens.css';
import App from './App.svelte';

// First thing, so it captures console output and uncaught errors from the
// rest of startup — including anything thrown while mounting below.
initDebugLog();

const app = mount(App, { target: document.getElementById('app') });

export default app;
