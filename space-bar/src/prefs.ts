import './prefs.css';

// The uploaded campaign and the Mission Lab originally carried separate copies
// of this state. Re-export the Lab's superset so the title, trip HUD, badges,
// light/dark theme and French text always read and update one saved preference.
export { preferenceControls, uiText } from './missionlab';
