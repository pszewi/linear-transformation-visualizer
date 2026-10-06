import { mount } from 'svelte';
import App from './ui/App.svelte';
import './styles/tokens.css';

const target = document.getElementById('app');
if (!target) throw new Error('#app not found');

export default mount(App, { target });
