import { mount } from 'svelte';
import { initDebugLog } from '../lib/debug-log.js';
import Telescope from './Telescope.svelte';

// First thing, so it captures console output and uncaught errors from the
// rest of startup — including anything thrown while mounting below.
initDebugLog();

const app = mount(Telescope, { target: document.getElementById('app') });

export default app;
