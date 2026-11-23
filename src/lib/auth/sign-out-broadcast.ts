/** Tells the app's other tabs that this device signed out, so none keeps the old account open. */
const CHANNEL = 'match-sketch-auth';

export function announceSignOut(): void {
	if (typeof BroadcastChannel === 'undefined') return;
	const channel = new BroadcastChannel(CHANNEL);
	channel.postMessage('signed-out');
	channel.close();
}

/** Calls `onSignOut` when another tab signs this device out; returns a function that stops. */
export function onSignOutElsewhere(onSignOut: () => void): () => void {
	if (typeof BroadcastChannel === 'undefined') return () => {};
	const channel = new BroadcastChannel(CHANNEL);
	channel.onmessage = (event) => {
		if (event.data === 'signed-out') onSignOut();
	};
	return () => channel.close();
}
